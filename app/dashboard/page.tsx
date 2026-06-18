'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

interface Dish {
  id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'any';
  ingredients?: string[] | null;
  prep_instructions?: string | null;
}

interface PlanEntry {
  meal_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  dish_id: string;
  dish_name: string;
  prep_instructions?: string | null;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [todayPlan, setTodayPlan] = useState<PlanEntry[]>([]);
  const [guestMode, setGuestMode] = useState(false);
  const [guestCount, setGuestCount] = useState(6);
  const [message, setMessage] = useState<string | null>(null);

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
      .select('id, name, prep_instructions');

    type DishNameResult = { id: string; name: string; prep_instructions?: string | null };
    const dishMap = new Map<string, { name: string; prep_instructions?: string | null }>();
    (dishesResult.data as DishNameResult[] | null)?.forEach(dish => dishMap.set(dish.id, { name: dish.name, prep_instructions: dish.prep_instructions }));

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

  const sendToCook = () => {
    const breakfastDish = todayPlan.find(item => item.meal_type === 'breakfast');
    const lunchDish = todayPlan.find(item => item.meal_type === 'lunch');
    const dinnerDish = todayPlan.find(item => item.meal_type === 'dinner');
    const note = guestMode ? `\n⚠️ Note: Cooking for ${guestCount} people today instead of 2.` : '';

    const message = `*Menu for ${todayLabel}*\n\n` +
      `☀️ *Breakfast:* ${breakfastDish?.dish_name || 'Not planned'}\n` +
      `🕛 *Lunch:* ${lunchDish?.dish_name || 'Not planned'}\n` +
      `🌙 *Dinner:* ${dinnerDish?.dish_name || 'Not planned'}${note}\n\n` +
      `_Sent via Meal Planner_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shuffleToday = async () => {
    if (!session) {
      setMessage('Sign in to shuffle with recency filtering.');
      return;
    }

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
      return;
    }

    const excluded = new Set<string>((historyData ?? []).map(entry => entry.dish_id));

    const { data: dishData, error: dishError } = await supabase
      .from('dishes')
      .select('id, name, meal_type');

    if (dishError) {
      setMessage(dishError.message);
      setLoading(false);
      return;
    }

    const chooseDish = (mealType: 'breakfast' | 'lunch' | 'dinner') => {
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
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Welcome back</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Your dashboard</h1>
              <p className="mt-2 text-sm text-slate-500">Manage your meal schedule, inventory, and guest mode from one place.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dishes" className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                Dish manager
              </Link>
              <Link href="/search" className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                Search web dishes
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Today</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{todayLabel}</h2>
              </div>
              <div className="flex items-center gap-2 rounded-3xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {session?.user.email ?? 'Guest'}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {['breakfast', 'lunch', 'dinner'].map(type => {
                const entry = todayPlan.find(item => item.meal_type === type);
                return (
                  <div key={type} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700 uppercase tracking-[0.24em]">{type}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{entry?.dish_name ?? 'No plan'}</span>
                    </div>
                  </div>
                );
              })}
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

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Guest mode</h2>
            <p className="mt-2 text-sm text-slate-500">Scale up your meal plan when more people arrive.</p>
            <div className="mt-5 space-y-4">
              <label className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={guestMode}
                  onChange={() => setGuestMode(prev => !prev)}
                  className="h-5 w-5 rounded border-slate-300 text-emerald-600"
                />
                <span className="text-sm font-medium text-slate-700">Enable guest mode</span>
              </label>

              <div className="grid gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-sm text-slate-700">People to cook for</label>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={guestCount}
                  onChange={event => setGuestCount(Number(event.target.value))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            {guestMode && (
              <div className="mt-5 rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">
                Guest mode will add a cook note to your WhatsApp menu broadcast.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
