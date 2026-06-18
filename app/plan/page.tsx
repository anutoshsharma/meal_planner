'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface Dish {
  id: string;
  name: string;
  meal_type: MealType | 'any';
}

interface PlanEntry {
  meal_date: string;
  meal_type: MealType;
  dish_id: string;
  dish_name: string;
}

const mealNames: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export default function PlanPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [plan, setPlan] = useState<PlanEntry[]>([]);
  const [windowDays, setWindowDays] = useState<3 | 7>(3);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPlan();
  }, [windowDays]);

  const getWindowDates = () => {
    const today = new Date();
    return Array.from({ length: windowDays }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date.toISOString().slice(0, 10);
    });
  };

  async function loadPlan() {
    setLoading(true);
    setMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const dates = getWindowDates();
    const { data: planData, error: planError } = await supabase
      .from('meal_plan')
      .select('meal_date, meal_type, dish_id')
      .eq('user_id', session.user.id)
      .in('meal_date', dates);

    const { data: dishData, error: dishError } = await supabase
      .from('dishes')
      .select('id, name, meal_type')
      .order('name', { ascending: true });

    if (planError || dishError) {
      setMessage(planError?.message ?? dishError?.message ?? 'Unable to load plan.');
      setLoading(false);
      return;
    }

    type DishNameResult = { id: string; name: string };
    const dishMap = new Map<string, string>();
    (dishData as DishNameResult[] | null ?? []).forEach(dish => dishMap.set(dish.id, dish.name));

    setDishes(dishData ?? []);
    setPlan(
      (planData ?? []).map(entry => ({
        meal_date: entry.meal_date,
        meal_type: entry.meal_type,
        dish_id: entry.dish_id,
        dish_name: dishMap.get(entry.dish_id) ?? 'Unknown',
      }))
    );
    setLoading(false);
  }

  const savePlan = async (date: string, meal_type: MealType, dish_id: string) => {
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('meal_plan')
      .upsert({ user_id: session.user.id, meal_date: date, meal_type, dish_id }, { onConflict: 'user_id,meal_date,meal_type' });

    if (error) {
      setMessage(error.message);
      return;
    }

    const dish = dishes.find(item => item.id === dish_id);
    setPlan(prev => {
      const existing = prev.find(entry => entry.meal_date === date && entry.meal_type === meal_type);
      if (existing) {
        return prev.map(entry => (entry.meal_date === date && entry.meal_type === meal_type ? { ...entry, dish_id, dish_name: dish?.name ?? 'Unknown' } : entry));
      }
      return [...prev, { meal_date: date, meal_type, dish_id, dish_name: dish?.name ?? 'Unknown' }];
    });
  };

  const windowDates = getWindowDates();

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Meal calendar</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Plan your next {windowDays} days</h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWindowDays(3)}
                className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${windowDays === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                3 days
              </button>
              <button
                type="button"
                onClick={() => setWindowDays(7)}
                className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${windowDays === 7 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                7 days
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">Loading your plan…</div>
        ) : (
          <div className="space-y-4">
            {windowDates.map(date => {
              const dateLabel = new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <div key={date} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{dateLabel}</p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-900">{date}</h2>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(meal_type => {
                      const currentEntry = plan.find(entry => entry.meal_date === date && entry.meal_type === meal_type);
                      return (
                        <div key={meal_type} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{mealNames[meal_type]}</p>
                          <div className="mt-3 space-y-3">
                            <p className="min-h-[2rem] text-sm font-semibold text-slate-900">{currentEntry?.dish_name ?? 'No dish selected'}</p>
                            <select
                              value={currentEntry?.dish_id ?? ''}
                              onChange={event => savePlan(date, meal_type, event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            >
                              <option value="">Select a dish</option>
                              {dishes.map(dish => (
                                <option key={dish.id} value={dish.id}>{dish.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
