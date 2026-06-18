'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

interface InventoryItem {
  id: string;
  ingredient: string;
  have: boolean;
}

interface Dish {
  id: string;
  name: string;
  ingredients?: string[] | null;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tomorrowIngredients, setTomorrowIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newIngredient, setNewIngredient] = useState('');

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().slice(0, 10);

    const inventoryResult = await supabase.from('inventory_items').select('*').eq('user_id', session.user.id).order('ingredient', { ascending: true });
    const planResult = await supabase.from('meal_plan').select('dish_id').eq('user_id', session.user.id).eq('meal_date', dateString);
    const dishesResult = await supabase.from('dishes').select('id, ingredients').eq('user_id', session.user.id);

    if (inventoryResult.error || planResult.error || dishesResult.error) {
      setError(inventoryResult.error?.message ?? planResult.error?.message ?? dishesResult.error?.message ?? 'Unable to load inventory.');
      setLoading(false);
      return;
    }

    setInventory(inventoryResult.data ?? []);

    const dishMap = new Map<string, string[]>();
    (dishesResult.data ?? []).forEach((dish: Dish) => dishMap.set(dish.id, dish.ingredients ?? []));

    const ingredientList = (planResult.data ?? [])
      .flatMap((entry: { dish_id: string }) => dishMap.get(entry.dish_id) ?? [])
      .map(item => item.trim())
      .filter(Boolean);

    setTomorrowIngredients(Array.from(new Set(ingredientList)));
    setLoading(false);
  }

  const toggleHave = async (item: InventoryItem) => {
    const { error } = await supabase.from('inventory_items').update({ have: !item.have }).eq('id', item.id);
    if (error) {
      setError(error.message);
      return;
    }
    setInventory(prev => prev.map(row => (row.id === item.id ? { ...row, have: !row.have } : row)));
  };

  const addInventoryItem = async () => {
    const trimmed = newIngredient.trim();
    if (!trimmed) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('inventory_items').insert({ ingredient: trimmed, have: true, user_id: session.user.id });
    if (error) {
      setError(error.message);
      return;
    }

    setNewIngredient('');
    await loadInventory();
  };

  const missingIngredients = tomorrowIngredients.filter(ingredient => {
    const match = inventory.find(item => item.ingredient.toLowerCase() === ingredient.toLowerCase());
    return !match || !match.have;
  });

  const commerceText = missingIngredients.length
    ? `Please buy: ${missingIngredients.join(', ')}.`
    : 'You have all ingredients for tomorrow.';

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Inventory audit</h1>
          <p className="mt-2 text-sm text-slate-500">Review whether you have ingredients for tomorrow and generate a quick commerce list.</p>

          {loading ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">Loading inventory…</div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-sm font-semibold text-slate-900">Tomorrow's checklist</h2>
                {tomorrowIngredients.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No ingredients are needed for tomorrow yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {tomorrowIngredients.map(ingredient => {
                      const inventoryItem = inventory.find(item => item.ingredient.toLowerCase() === ingredient.toLowerCase());
                      return (
                        <div key={ingredient} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-sm text-slate-900">Do you have {ingredient}?</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${inventoryItem?.have ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {inventoryItem?.have ? 'Yes' : 'No'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">Quick commerce export</h2>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(commerceText)}
                    className="rounded-3xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Copy list
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-600">Paste this directly into Zepto, Blinkit, or Instamart search.</p>
                <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                  {commerceText}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-900">Add inventory item</label>
                  <div className="flex gap-2">
                    <input
                      value={newIngredient}
                      onChange={event => setNewIngredient(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      placeholder="e.g. Paneer"
                    />
                    <button
                      type="button"
                      onClick={addInventoryItem}
                      className="rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {inventory.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {inventory.map(item => (
                      <div key={item.id} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
                        <span className="text-sm text-slate-900">{item.ingredient}</span>
                        <button
                          type="button"
                          onClick={() => toggleHave(item)}
                          className={`rounded-3xl px-4 py-2 text-sm font-semibold transition ${item.have ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {item.have ? 'Have' : 'Missing'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
