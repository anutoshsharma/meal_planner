'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface Dish {
  id: string;
  name: string;
  meal_type: MealType | 'any';
  ingredients?: string[] | null;
  prep_instructions?: string | null;
}

interface PlanEntry {
  meal_date: string;
  meal_type: MealType;
  dish_id: string;
  dish_name: string;
  prep_instructions?: string | null;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [todayPlan, setTodayPlan] = useState<PlanEntry[]>([]);
  const [guestMode, setGuestMode] = useState(false);
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestInputValue, setGuestInputValue] = useState(2);
  const [dishOptions, setDishOptions] = useState<Dish[]>([]);
  const [extraDishes, setExtraDishes] = useState<Record<MealType, string[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
  });
  const [message, setMessage] = useState<string | null>(null);
  const [animatingButton, setAnimatingButton] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);
    if (!session) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('meal_plan')
      .select('meal_date, meal_type, dish_id')
      .eq('user_id', session.user.id)
      .eq('meal_date', today);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const dishesResult = await supabase
      .from('dishes')
      .select('id, name, prep_instructions, meal_type');

    const dishMap = new Map<string, { name: string; prep_instructions?: string | null }>();
    (dishesResult.data as Dish[] | null)?.forEach(dish => dishMap.set(dish.id, { name: dish.name, prep_instructions: dish.prep_instructions }));
    setDishOptions((dishesResult.data as Dish[] | null) ?? []);

    setTodayPlan(
      (data ?? []).map(item => {
        const dish = dishMap.get(item.dish_id);
        return {
          meal_date: item.meal_date,
          meal_type: item.meal_type,
          dish_id: item.dish_id,
          dish_name: dish?.name ?? 'Unknown dish',
          prep_instructions: dish?.prep_instructions ?? null,
        };
      })
    );

    setLoading(false);
  }

  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  const handleGuestToggle = () => {
    const next = !guestMode;
    setGuestMode(next);
    if (next && !guestCount) {
      setGuestInputValue(2);
      setGuestModalOpen(true);
    }
  };

  const handleSaveGuestCount = () => {
    if (guestInputValue < 1) {
      return;
    }
    setGuestCount(guestInputValue);
    setGuestModalOpen(false);
  };

  const addExtraDish = (mealType: MealType) => {
    setExtraDishes(prev => ({
      ...prev,
      [mealType]: [...prev[mealType], dishOptions[0]?.id ?? ''],
    }));
  };

  const updateExtraDish = (mealType: MealType, index: number, dishId: string) => {
    setExtraDishes(prev => ({
      ...prev,
      [mealType]: prev[mealType].map((id, idx) => (idx === index ? dishId : id)),
    }));
  };

  const removeExtraDish = (mealType: MealType, index: number) => {
    setExtraDishes(prev => ({
      ...prev,
      [mealType]: prev[mealType].filter((_, idx) => idx !== index),
    }));
  };

  const getDishName = (id: string) => dishOptions.find(dish => dish.id === id)?.name || 'Unknown dish';

  const sendToCook = () => {
    const breakfastDish = todayPlan.find(item => item.meal_type === 'breakfast');
    const lunchDish = todayPlan.find(item => item.meal_type === 'lunch');
    const dinnerDish = todayPlan.find(item => item.meal_type === 'dinner');
    const extraLines = (['breakfast', 'lunch', 'dinner'] as MealType[])
      .flatMap(mealType => {
        const extras = extraDishes[mealType].filter(Boolean).map(getDishName);
        return extras.length ? [`*${mealType[0].toUpperCase() + mealType.slice(1)} extras:* ${extras.join(', ')}`] : [];
      })
      .join('\n');

    const guestInfo = guestMode && guestCount
      ? `\n⚠️ Cooking for ${guestCount} people today.${extraLines ? `\n${extraLines}` : ''}`
      : '';

    const message = `*Menu for ${todayLabel}*\n\n` +
      `☀️ *Breakfast:* ${breakfastDish?.dish_name || 'Not planned'}\n` +
      `🕛 *Lunch:* ${lunchDish?.dish_name || 'Not planned'}\n` +
      `🌙 *Dinner:* ${dinnerDish?.dish_name || 'Not planned'}${guestInfo}\n\n` +
      `_Sent via Meal Planner_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shuffleToday = async () => {
    if (!session) {
      setMessage('Sign in to shuffle with recency filtering.');
      return;
    }

    setAnimatingButton('shuffle-all');
    setLoading(true);
    setMessage(null);

    const todayString = new Date().toISOString().slice(0, 10);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fromDate = fourDaysAgo.toISOString().slice(0, 10);

    const { data: historyData, error: historyError } = await supabase
      .from('meal_plan')
      .select('dish_id')
      .eq('user_id', session.user.id)
      .gte('meal_date', fromDate)
      .lt('meal_date', todayString);

    if (historyError) {
      setMessage(historyError.message);
      setLoading(false);
      setAnimatingButton(null);
      return;
    }

    const excluded = new Set<string>((historyData ?? []).map(entry => entry.dish_id));

    const { data: dishData, error: dishError } = await supabase
      .from('dishes')
      .select('id, name, meal_type');

    if (dishError) {
      setMessage(dishError.message);
      setLoading(false);
      setAnimatingButton(null);
      return;
    }

    const chooseDish = (mealType: MealType) => {
      const pool = (dishData ?? []).filter(
        dish => (dish.meal_type === mealType || dish.meal_type === 'any') && !excluded.has(dish.id)
      );
      const fallback = (dishData ?? []).filter(dish => dish.meal_type === mealType || dish.meal_type === 'any');
      const selection = pool.length ? pool : fallback;
      return selection[Math.floor(Math.random() * selection.length)] || null;
    };

    const breakfastDish = chooseDish('breakfast');
    const lunchDish = chooseDish('lunch');
    const dinnerDish = chooseDish('dinner');

    const uptoDateEntries = [
      { meal_type: 'breakfast', dish_id: breakfastDish?.id },
      { meal_type: 'lunch', dish_id: lunchDish?.id },
      { meal_type: 'dinner', dish_id: dinnerDish?.id },
    ].filter(entry => entry.dish_id);

    await Promise.all(
      uptoDateEntries.map(entry =>
        supabase.from('meal_plan').upsert(
          {
            user_id: session.user.id,
            meal_date: todayString,
            meal_type: entry.meal_type,
            dish_id: entry.dish_id,
          },
          { onConflict: 'user_id,meal_date,meal_type' }
        )
      )
    );

    await loadDashboard();
    setLoading(false);
    setTimeout(() => setAnimatingButton(null), 600);
  };

  const shuffleMeal = async (mealType: MealType) => {
    if (!session) {
      setMessage('Sign in to shuffle meals.');
      return;
    }

    setAnimatingButton(`shuffle-${mealType}`);
    setLoading(true);
    setMessage(null);

    const todayString = new Date().toISOString().slice(0, 10);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fromDate = fourDaysAgo.toISOString().slice(0, 10);

    const { data: historyData, error: historyError } = await supabase
      .from('meal_plan')
      .select('dish_id')
      .eq('user_id', session.user.id)
      .eq('meal_type', mealType)
      .gte('meal_date', fromDate)
      .lt('meal_date', todayString);

    if (historyError) {
      setMessage(historyError.message);
      setLoading(false);
      setAnimatingButton(null);
      return;
    }

    const excluded = new Set<string>((historyData ?? []).map(entry => entry.dish_id));

    const { data: dishData, error: dishError } = await supabase
      .from('dishes')
      .select('id, name, meal_type');

    if (dishError) {
      setMessage(dishError.message);
      setLoading(false);
      setAnimatingButton(null);
      return;
    }

    const pool = (dishData ?? []).filter(
      dish => (dish.meal_type === mealType || dish.meal_type === 'any') && !excluded.has(dish.id)
    );
    const fallback = (dishData ?? []).filter(dish => dish.meal_type === mealType || dish.meal_type === 'any');
    const selection = pool.length ? pool : fallback;
    const chosen = selection[Math.floor(Math.random() * selection.length)] || null;

    if (chosen) {
      await supabase.from('meal_plan').upsert(
        {
          user_id: session.user.id,
          meal_date: todayString,
          meal_type: mealType,
          dish_id: chosen.id,
        },
        { onConflict: 'user_id,meal_date,meal_type' }
      );
    }

    await loadDashboard();
    setLoading(false);
    setTimeout(() => setAnimatingButton(null), 600);
  };

  const prepInstructions = (['breakfast', 'lunch', 'dinner'] as MealType[])
    .map(type => {
      const entry = todayPlan.find(item => item.meal_type === type);
      return entry?.prep_instructions ? { mealType: type, text: entry.prep_instructions } : null;
    })
    .filter(Boolean) as { mealType: MealType; text: string }[];

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Today</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{todayLabel}</h2>
              </div>
              <div className="flex items-center gap-3 rounded-3xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                <button
                  type="button"
                  onClick={shuffleToday}
                  aria-label="Shuffle all meals"
                  title="Shuffle all meals"
                  className="rounded-3xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  style={{
                    transform: animatingButton === 'shuffle-all' ? 'rotate(360deg)' : 'rotate(0deg)',
                    transition: animatingButton === 'shuffle-all' ? 'transform 0.6s ease-in-out' : 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 inline" fill="currentColor" aria-hidden="true">
                    <rect x="3" y="3" width="8" height="8" />
                    <rect x="13" y="3" width="8" height="8" />
                    <rect x="3" y="13" width="8" height="8" />
                    <rect x="13" y="13" width="8" height="8" />
                    <circle cx="7" cy="7" r="1.5" fill="white" />
                    <circle cx="17" cy="7" r="1.5" fill="white" />
                    <circle cx="7" cy="17" r="1.5" fill="white" />
                    <circle cx="17" cy="17" r="1.5" fill="white" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-amber-900 uppercase tracking-[0.24em]">Prep instructions</p>
              </div>
              <div className="space-y-3">
                {prepInstructions.length > 0 ? (
                  prepInstructions.map(item => (
                    <p key={item.mealType} className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">{item.mealType.charAt(0).toUpperCase() + item.mealType.slice(1)}:</span> {item.text}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No prep instructions available for today.</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(type => {
                const entry = todayPlan.find(item => item.meal_type === type);
                return (
                  <div key={type} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700 uppercase tracking-[0.24em]">{type}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{entry?.dish_name ?? 'No plan'}</span>
                        <button
                          type="button"
                          onClick={() => shuffleMeal(type)}
                          aria-label={`Shuffle ${type}`}
                          title={`Shuffle ${type}`}
                          className="rounded-3xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          style={{
                            transform: animatingButton === `shuffle-${type}` || animatingButton === 'shuffle-all' ? 'rotate(360deg)' : 'rotate(0deg)',
                            transition: animatingButton === `shuffle-${type}` || animatingButton === 'shuffle-all' ? 'transform 0.6s ease-in-out' : 'none',
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 inline" fill="currentColor" aria-hidden="true">
                            <rect x="3" y="3" width="8" height="8" />
                            <rect x="13" y="3" width="8" height="8" />
                            <rect x="3" y="13" width="8" height="8" />
                            <rect x="13" y="13" width="8" height="8" />
                            <circle cx="7" cy="7" r="1.5" fill="white" />
                            <circle cx="17" cy="7" r="1.5" fill="white" />
                            <circle cx="7" cy="17" r="1.5" fill="white" />
                            <circle cx="17" cy="17" r="1.5" fill="white" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {guestMode && (
                      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-700">Extra {type} dishes</p>
                          <button
                            type="button"
                            onClick={() => addExtraDish(type)}
                            className="rounded-3xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            Add dish
                          </button>
                        </div>
                        <div className="mt-3 space-y-3">
                          {extraDishes[type].map((dishId, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <select
                                value={dishId}
                                onChange={event => updateExtraDish(type, index, event.target.value)}
                                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none"
                              >
                                {dishOptions
                                  .filter(dish => dish.meal_type === type || dish.meal_type === 'any')
                                  .map(dish => (
                                    <option key={dish.id} value={dish.id}>
                                      {dish.name}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeExtraDish(type, index)}
                                className="rounded-3xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <span>Guest mode</span>
                  <input
                    type="checkbox"
                    checked={guestMode}
                    onChange={handleGuestToggle}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600"
                  />
                </label>
                {guestMode && guestCount ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <span>Guests: {guestCount}</span>
                    <button
                      type="button"
                      onClick={() => setGuestModalOpen(true)}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm"
                    >
                      Edit
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={sendToCook}
                className="rounded-3xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Send WhatsApp broadcast
              </button>
              <Link href="/plan" className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 text-center">
                Open weekly plan
              </Link>
            </div>
          </div>

          {guestModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-slate-900">Guest count</h3>
                <p className="mt-2 text-sm text-slate-500">Enter how many people you are cooking for.</p>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Number of people
                    <input
                      type="number"
                      min={1}
                      value={guestInputValue}
                      onChange={event => setGuestInputValue(Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
                    />
                  </label>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setGuestModalOpen(false)}
                      className="rounded-3xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGuestCount}
                      className="rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
