'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'any';

interface Dish {
  id: string;
  name: string;
  meal_type: MealType;
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
  const [tomorrowPlan, setTomorrowPlan] = useState<PlanEntry[]>([]);
  
  const [guestMode, setGuestMode] = useState(false);
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestInputValue, setGuestInputValue] = useState(2);
  const [dishOptions, setDishOptions] = useState<Dish[]>([]);
  const [extraDishes, setExtraDishes] = useState<Record<MealType, string[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
    any: []
  });
  const [message, setMessage] = useState<string | null>(null);
  const [animatingButton, setAnimatingButton] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    
    if (!session) {
      setLoading(false);
      return;
    }

    // Get Today and Tomorrow Dates
    const todayObj = new Date();
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    
    const todayString = todayObj.toISOString().slice(0, 10);
    const tomorrowString = tomorrowObj.toISOString().slice(0, 10);

    // Fetch meal plan for BOTH days
    const { data, error } = await supabase
      .from('meal_plan')
      .select('meal_date, meal_type, dish_id')
      .eq('user_id', session.user.id)
      .in('meal_date', [todayString, tomorrowString]);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    // Fetch dishes
    const dishesResult = await supabase
      .from('dishes')
      .select('id, name, prep_instructions, meal_type');

    const dishMap = new Map<string, { name: string; prep_instructions?: string | null }>();
    (dishesResult.data as Dish[] | null)?.forEach(dish => dishMap.set(dish.id, { name: dish.name, prep_instructions: dish.prep_instructions }));
    setDishOptions((dishesResult.data as Dish[] | null) ?? []);

    // Separate into Today and Tomorrow Plans
    const formattedData = (data ?? []).map(item => {
      const dish = dishMap.get(item.dish_id);
      return {
        meal_date: item.meal_date,
        meal_type: item.meal_type as MealType,
        dish_id: item.dish_id,
        dish_name: dish?.name ?? 'Unknown dish',
        prep_instructions: dish?.prep_instructions ?? null,
      };
    });

    setTodayPlan(formattedData.filter(d => d.meal_date === todayString));
    setTomorrowPlan(formattedData.filter(d => d.meal_date === tomorrowString));

    setLoading(false);
  }

  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  // Guest Handlers
  const handleGuestToggle = () => {
    const next = !guestMode;
    setGuestMode(next);
    if (next && !guestCount) {
      setGuestInputValue(2);
      setGuestModalOpen(true);
    }
  };

  const handleSaveGuestCount = () => {
    if (guestInputValue < 1) return;
    setGuestCount(guestInputValue);
    setGuestModalOpen(false);
  };

  const addExtraDish = (mealType: MealType) => {
    setExtraDishes(prev => ({ ...prev, [mealType]: [...prev[mealType], dishOptions[0]?.id ?? ''] }));
  };

  const updateExtraDish = (mealType: MealType, index: number, dishId: string) => {
    setExtraDishes(prev => ({ ...prev, [mealType]: prev[mealType].map((id, idx) => (idx === index ? dishId : id)) }));
  };

  const removeExtraDish = (mealType: MealType, index: number) => {
    setExtraDishes(prev => ({ ...prev, [mealType]: prev[mealType].filter((_, idx) => idx !== index) }));
  };

  const getDishName = (id: string) => dishOptions.find(dish => dish.id === id)?.name || 'Unknown dish';

  // WhatsApp Sender
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
      ? `\n⚠️ *Guest Alert:* Cooking for ${guestCount} people today.\n${extraLines ? `${extraLines}\n` : ''}`
      : '';

    // Add tomorrow's prep to the bottom of today's message!
    const tomorrowPrepTexts = tomorrowPlan
      .filter(item => item.prep_instructions && item.prep_instructions.trim() !== '')
      .map(item => `- For ${item.dish_name}: ${item.prep_instructions}`);
      
    const prepMessage = tomorrowPrepTexts.length > 0 
      ? `\n🌙 *Night-Before Prep for Tomorrow:*\n${tomorrowPrepTexts.join('\n')}\n` 
      : '';

    const message = `*Menu for ${todayLabel}*\n\n` +
      `☀️ *Breakfast:* ${breakfastDish?.dish_name || 'Not planned'}\n` +
      `🕛 *Lunch:* ${lunchDish?.dish_name || 'Not planned'}\n` +
      `🍽️ *Dinner:* ${dinnerDish?.dish_name || 'Not planned'}\n` +
      `${guestInfo}${prepMessage}\n` +
      `_Sent via Meal Planner_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Shuffle Engines
  const shuffleToday = async () => {
    if (!session) { setMessage('Sign in to shuffle.'); return; }
    setAnimatingButton('shuffle-all');
    setLoading(true);

    const todayString = new Date().toISOString().slice(0, 10);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const fromDate = fourDaysAgo.toISOString().slice(0, 10);

    const { data: historyData } = await supabase.from('meal_plan').select('dish_id').eq('user_id', session.user.id).gte('meal_date', fromDate).lt('meal_date', todayString);
    const excluded = new Set<string>((historyData ?? []).map(entry => entry.dish_id));
    const { data: dishData } = await supabase.from('dishes').select('id, name, meal_type');

    const chooseDish = (mealType: MealType) => {
      const pool = (dishData ?? []).filter(dish => (dish.meal_type === mealType || dish.meal_type === 'any') && !excluded.has(dish.id));
      const fallback = (dishData ?? []).filter(dish => dish.meal_type === mealType || dish.meal_type === 'any');
      const selection = pool.length ? pool : fallback;
      return selection[Math.floor(Math.random() * selection.length)] || null;
    };

    const uptoDateEntries = [
      { meal_type: 'breakfast', dish_id: chooseDish('breakfast')?.id },
      { meal_type: 'lunch', dish_id: chooseDish('lunch')?.id },
      { meal_type: 'dinner', dish_id: chooseDish('dinner')?.id },
    ].filter(entry => entry.dish_id);

    await Promise.all(
      uptoDateEntries.map(entry =>
        supabase.from('meal_plan').upsert(
          { user_id: session.user.id, meal_date: todayString, meal_type: entry.meal_type, dish_id: entry.dish_id },
          { onConflict: 'user_id,meal_date,meal_type' }
        )
      )
    );

    await loadDashboard();
    setTimeout(() => setAnimatingButton(null), 600);
  };

  const shuffleMeal = async (mealType: MealType) => {
    if (!session) return;
    setAnimatingButton(`shuffle-${mealType}`);
    setLoading(true);

    const todayString = new Date().toISOString().slice(0, 10);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    
    const { data: historyData } = await supabase.from('meal_plan').select('dish_id').eq('user_id', session.user.id).eq('meal_type', mealType).gte('meal_date', fourDaysAgo.toISOString().slice(0, 10)).lt('meal_date', todayString);
    const excluded = new Set<string>((historyData ?? []).map(entry => entry.dish_id));
    const { data: dishData } = await supabase.from('dishes').select('id, name, meal_type');

    const pool = (dishData ?? []).filter(dish => (dish.meal_type === mealType || dish.meal_type === 'any') && !excluded.has(dish.id));
    const fallback = (dishData ?? []).filter(dish => dish.meal_type === mealType || dish.meal_type === 'any');
    const chosen = (pool.length ? pool : fallback)[Math.floor(Math.random() * (pool.length ? pool : fallback).length)] || null;

    if (chosen) {
      await supabase.from('meal_plan').upsert(
        { user_id: session.user.id, meal_date: todayString, meal_type: mealType, dish_id: chosen.id },
        { onConflict: 'user_id,meal_date,meal_type' }
      );
    }
    await loadDashboard();
    setTimeout(() => setAnimatingButton(null), 600);
  };

  // Extract prep instructions for TOMORROW
  const tomorrowPrepInstructions = tomorrowPlan
    .filter(item => item.prep_instructions && item.prep_instructions.trim() !== '')
    .map(item => ({ mealType: item.meal_type, text: item.prep_instructions, dishName: item.dish_name }));

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* WELCOME BANNER */}
        <div className="flex flex-col mb-2">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Your kitchen overview for <strong className="text-slate-700">{todayLabel}</strong></p>
        </div>

        {message && (
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700 border border-slate-200 flex justify-between">
            {message} <button onClick={() => setMessage(null)} className="underline">Dismiss</button>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          
          {/* LEFT COLUMN: TODAY'S MENU */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span>🍽️</span> Today's Menu
              </h2>
              <button
                type="button"
                onClick={shuffleToday}
                className="flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-600 px-4 py-2 text-xs font-bold uppercase tracking-wider transition hover:bg-indigo-100"
              >
                <span>Shuffle All</span>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" style={{ transform: animatingButton === 'shuffle-all' ? 'rotate(360deg)' : 'rotate(0deg)', transition: animatingButton === 'shuffle-all' ? 'transform 0.6s ease-in-out' : 'none' }}>
                  <rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="8" /><rect x="3" y="13" width="8" height="8" /><rect x="13" y="13" width="8" height="8" />
                  <circle cx="7" cy="7" r="1.5" fill="white" /><circle cx="17" cy="7" r="1.5" fill="white" /><circle cx="7" cy="17" r="1.5" fill="white" /><circle cx="17" cy="17" r="1.5" fill="white" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 flex-grow">
              {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(type => {
                const entry = todayPlan.find(item => item.meal_type === type);
                return (
                  <div key={type} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-slate-300">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{type}</p>
                        <p className="text-base font-semibold text-slate-900">{entry?.dish_name ?? <span className="text-slate-400 font-normal italic">Not planned</span>}</p>
                      </div>
                      <button
                        onClick={() => shuffleMeal(type)}
                        className="rounded-full bg-white border border-slate-200 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition shadow-sm"
                        style={{ transform: animatingButton === `shuffle-${type}` ? 'rotate(360deg)' : 'rotate(0deg)', transition: animatingButton === `shuffle-${type}` ? 'transform 0.6s ease-in-out' : 'none' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                      </button>
                    </div>

                    {/* Guest Extra Dishes List */}
                    {guestMode && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Extra Dishes</p>
                          <button onClick={() => addExtraDish(type)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">+ Add</button>
                        </div>
                        <div className="space-y-2">
                          {extraDishes[type].map((dishId, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <select
                                value={dishId}
                                onChange={event => updateExtraDish(type, index, event.target.value)}
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                              >
                                {dishOptions.filter(dish => dish.meal_type === type || dish.meal_type === 'any').map(dish => (
                                    <option key={dish.id} value={dish.id}>{dish.name}</option>
                                ))}
                              </select>
                              <button onClick={() => removeExtraDish(type, index)} className="text-xs font-medium text-rose-500 hover:text-rose-700 px-2">X</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Guest Mode Toggle */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={guestMode} onChange={handleGuestToggle} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Enable Guest Mode</span>
              </label>
              
              {guestMode && guestCount && (
                <button onClick={() => setGuestModalOpen(true)} className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition">
                  <span>{guestCount} Guests</span>
                  <span className="underline">Edit</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: PREP & ACTIONS */}
          <div className="flex flex-col gap-6">
            
            {/* ACTION CENTER */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span>⚡</span> Quick Actions
              </h2>
              <div className="space-y-3">
                <button
                  onClick={sendToCook}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1ebd5a]"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  Send to Cook via WhatsApp
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/inventory" className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:border-slate-300">
                    <span className="text-lg">🛒</span> Check Inventory
                  </Link>
                  <Link href="/dishes" className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:border-slate-300">
                    <span className="text-lg">📖</span> My Dishes
                  </Link>
                </div>
              </div>
            </div>

            {/* TONIGHT'S PREP BOX (FETCHED FROM TOMORROW) */}
            <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6 shadow-sm flex-grow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
                  <span>🌙</span> Tonight's Prep
                </h2>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-700 bg-orange-100 px-2 py-1 rounded-md">For Tomorrow</span>
              </div>
              
              <div className="space-y-3">
                {tomorrowPrepInstructions.length > 0 ? (
                  tomorrowPrepInstructions.map((item, idx) => (
                    <div key={idx} className="bg-white/60 p-3 rounded-xl border border-orange-100/50">
                      <p className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-1">{item.mealType}</p>
                      <p className="text-sm text-slate-800"><span className="font-semibold">{item.dishName}:</span> {item.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-orange-800/80 italic">No advance prep required for tomorrow's meals. You can relax!</p>
                )}
                
                {tomorrowPlan.length === 0 && (
                  <Link href="/plan" className="block text-sm text-center text-orange-800 mt-4 underline underline-offset-4 decoration-orange-300 hover:text-orange-900">
                    You haven't planned tomorrow's menu yet. Click here to plan.
                  </Link>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* GUEST MODAL */}
        {guestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Guest count</h3>
              <p className="mt-1 text-sm text-slate-500 mb-5">How many extra people are eating today?</p>
              <input
                type="number"
                min={1}
                value={guestInputValue}
                onChange={event => setGuestInputValue(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-semibold text-slate-900 outline-none text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition"
              />
              <div className="mt-6 flex gap-3">
                <button onClick={() => {setGuestModalOpen(false); setGuestMode(false);}} className="w-full rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                  Cancel
                </button>
                <button onClick={handleSaveGuestCount} className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 shadow-sm">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}