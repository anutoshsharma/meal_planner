'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

interface Dish {
  id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'any';
  diet_type?: 'any' | 'veg' | 'nonveg';
  ingredients?: string[] | null;
  prep_instructions?: string | null;
}

const mealOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'any', label: 'Any meal' },
] as const;

const dietOptions = [
  { value: 'any', label: 'Any' },
  { value: 'veg', label: 'Veg' },
  { value: 'nonveg', label: 'Non-Veg' },
] as const;

export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDishId, setEditDishId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    name: '',
    meal_type: 'breakfast' as Dish['meal_type'],
    diet_type: 'any' as Dish['diet_type'],
    ingredients: '',
    prep_instructions: '',
  });

  useEffect(() => {
    loadDishes();
  }, []);

  async function loadDishes() {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setDishes([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name', { ascending: true });
    if (error) {
      setError(error.message);
    } else if (data) {
      setDishes(data);
    }
    setLoading(false);
  }

  const handleEdit = (dish: Dish) => {
    setEditDishId(dish.id);
    setFormValues({
      name: dish.name,
      meal_type: dish.meal_type,
      diet_type: dish.diet_type ?? 'any',
      ingredients: dish.ingredients?.join(', ') ?? '',
      prep_instructions: dish.prep_instructions ?? '',
    });
  };

  const resetForm = () => {
    setEditDishId(null);
    setFormValues({ name: '', meal_type: 'breakfast', diet_type: 'any', ingredients: '', prep_instructions: '' });
  };

  const handleSave = async () => {
    const trimmedName = formValues.name.trim();
    if (!trimmedName) {
      setError('Dish name is required.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Please sign in first.');
      return;
    }

    setError(null);
    const payload = {
      name: trimmedName,
      meal_type: formValues.meal_type,
      diet_type: formValues.diet_type,
      ingredients: formValues.ingredients
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      prep_instructions: formValues.prep_instructions.trim() || null,
      user_id: session.user.id,
    };

    const query = editDishId
      ? supabase.from('dishes').update(payload).eq('id', editDishId).eq('user_id', session.user.id)
      : supabase.from('dishes').insert(payload);

    const { error } = await query;
    if (error) {
      setError(error.message);
      return;
    }

    await loadDishes();
    resetForm();
  };

  const handleDelete = async (dishId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Please sign in first.');
      return;
    }
    const { error } = await supabase.from('dishes').delete().eq('id', dishId).eq('user_id', session.user.id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadDishes();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Dish Manager</h1>
          <p className="mt-2 text-sm text-slate-500">
            Add, edit, or delete dishes for your personal meal planner. Ingredients are auto-mapped so you can build quick inventory reminders.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Create or edit a dish</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Dish name
                  <input
                    value={formValues.name}
                    onChange={event => setFormValues(prev => ({ ...prev, name: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="e.g. Paneer tikka"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Meal type
                  <select
                    value={formValues.meal_type}
                    onChange={event => setFormValues(prev => ({ ...prev, meal_type: event.target.value as Dish['meal_type'] }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    {mealOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Diet type
                  <select
                    value={formValues.diet_type}
                    onChange={event => setFormValues(prev => ({ ...prev, diet_type: event.target.value as Dish['diet_type'] }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    {dietOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Ingredients (comma-separated)
                  <input
                    value={formValues.ingredients}
                    onChange={event => setFormValues(prev => ({ ...prev, ingredients: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="e.g. paneer, tomato, spices"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Prep instructions
                  <textarea
                    value={formValues.prep_instructions}
                    onChange={event => setFormValues(prev => ({ ...prev, prep_instructions: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    rows={4}
                    placeholder="Optional prep note for tomorrow's cook"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    {editDishId ? 'Update dish' : 'Save dish'}
                  </button>
                  {editDishId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-3xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 border border-slate-200 transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Dish list</h2>
              {loading ? (
                <div className="mt-4 text-sm text-slate-500">Loading dishes…</div>
              ) : dishes.length === 0 ? (
                <div className="mt-4 text-sm text-slate-500">No dishes yet. Add one to begin.</div>
              ) : (
                <div className="mt-4 space-y-4">
                  {dishes.map(dish => (
                    <div key={dish.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{dish.name}</p>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{dish.meal_type}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(dish)}
                            className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 transition hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(dish.id)}
                            className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 border border-red-200 transition hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {dish.ingredients?.length ? (
                        <p className="mt-3 text-sm text-slate-600">Ingredients: {dish.ingredients.join(', ')}</p>
                      ) : null}
                      {dish.prep_instructions ? (
                        <p className="mt-3 text-sm text-slate-600">Prep: {dish.prep_instructions}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
