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

interface SearchResult {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  [key: string]: any;
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

const ingredientKeywords = [
  'paneer', 'chicken', 'rice', 'dal', 'lentil', 'potato', 'tomato', 'spinach', 'beans', 'mushroom', 'cauliflower', 'egg', 'fish', 'prawn', 'mutton', 'goat', 'beef', 'pork', 'garam masala', 'cumin', 'turmeric', 'ginger', 'garlic', 'onion', 'yogurt', 'curd', 'coriander', 'cilantro', 'coconut', 'mustard seeds', 'chili', 'masala', 'cardamom', 'clove', 'cinnamon', 'cashew', 'almond'
];

const nonVegKeywords = ['chicken', 'mutton', 'goat', 'beef', 'pork', 'fish', 'egg', 'shrimp', 'prawn', 'crab', 'lobster', 'duck', 'seafood'];

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
  const [filterText, setFilterText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const filteredDishes = dishes.filter(dish => dish.name.toLowerCase().includes(filterText.toLowerCase()));

  useEffect(() => {
    loadDishes();
  }, []);

  async function loadDishes() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('dishes')
      .select('*')
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

  const getAutoMappedIngredients = (name: string, manualIngredients: string) => {
    const existing = manualIngredients
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    const lower = `${name} ${existing.join(' ')}`.toLowerCase();
    const autoMatches = ingredientKeywords.filter(keyword => lower.includes(keyword));
    return Array.from(new Set([...existing, ...autoMatches])).join(', ');
  };

  const fillFromRecipe = (meal: SearchResult) => {
    const ingredients = Array.from({ length: 20 }, (_, index) => {
      const ingredient = meal[`strIngredient${index + 1}`];
      const measure = meal[`strMeasure${index + 1}`];
      return ingredient && ingredient.trim() ? `${ingredient.trim()}${measure ? ` (${measure.trim()})` : ''}` : null;
    }).filter(Boolean) as string[];

    const detectedDiet = nonVegKeywords.some(keyword =>
      `${meal.strMeal.toLowerCase()} ${ingredients.join(' ').toLowerCase()}`.includes(keyword)
    )
      ? 'nonveg'
      : 'veg';

    setFormValues({
      name: meal.strMeal,
      meal_type: 'any',
      diet_type: detectedDiet as Dish['diet_type'],
      ingredients: ingredients.join(', '),
      prep_instructions: meal.strInstructions?.slice(0, 250) ?? '',
    });
    setSearchMessage(`${meal.strMeal} loaded into the form. You can edit and save it.`);
  };

  const searchWebDishes = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchMessage(null);
    setSearchResults([]);

    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchQuery)}`);
      const payload = await response.json();
      if (!payload || !payload.meals) {
        setSearchResults([]);
        setSearchMessage('No Indian recipes found. Try another query.');
      } else {
        const indianResults = (payload.meals as SearchResult[]).filter(result => result.strArea?.toLowerCase() === 'indian');
        setSearchResults(indianResults);
        if (indianResults.length === 0) {
          setSearchMessage('No Indian recipes found. Try another query.');
        }
      }
    } catch (error) {
      setSearchMessage('Unable to fetch recipes. Try again later.');
    }

    setSearchLoading(false);
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
      ingredients: getAutoMappedIngredients(trimmedName, formValues.ingredients),
      prep_instructions: formValues.prep_instructions.trim() || null,
    };

    const query = editDishId
      ? supabase.from('dishes').update(payload).eq('id', editDishId)
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
    const { error } = await supabase.from('dishes').delete().eq('id', dishId);
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
                <div className="mt-2 flex flex-col gap-2">
                  <label className="block text-sm font-medium text-slate-700">Search Indian recipes</label>
                  <div className="flex gap-2">
                    <input
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      onKeyDown={event => event.key === 'Enter' && searchWebDishes()}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      placeholder="Search web recipe names"
                    />
                    <button
                      type="button"
                      onClick={searchWebDishes}
                      className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {searchLoading ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                  {searchMessage && (
                    <p className="text-sm text-slate-600">{searchMessage}</p>
                  )}
                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Web results</p>
                      <div className="grid gap-3">
                        {searchResults.map(result => (
                          <div key={result.idMeal} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-semibold text-slate-900">{result.strMeal}</p>
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{result.strArea} · {result.strCategory}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => fillFromRecipe(result)}
                                className="rounded-3xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Load into form
                              </button>
                            </div>
                            <p className="mt-3 text-sm text-slate-600">{result.strInstructions?.slice(0, 120)}{result.strInstructions?.length ? '…' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Dish list</h2>
                  <p className="mt-2 text-sm text-slate-500">Shared catalog for all users. Use the filter to find a recipe quickly.</p>
                </div>
                <input
                  value={filterText}
                  onChange={event => setFilterText(event.target.value)}
                  className="w-full max-w-xs rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  placeholder="Filter dishes"
                />
              </div>
              {loading ? (
                <div className="mt-4 text-sm text-slate-500">Loading dishes…</div>
              ) : filteredDishes.length === 0 ? (
                <div className="mt-4 text-sm text-slate-500">No dishes found. Add one to begin.</div>
              ) : (
                <div className="mt-4 space-y-4">
                  {filteredDishes.map(dish => (
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
