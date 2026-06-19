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

const nonVegKeywords = ['chicken', 'mutton', 'goat', 'beef', 'pork', 'fish', 'egg', 'shrimp', 'prawn', 'crab', 'lobster', 'duck', 'seafood', 'meat', 'lamb'];

export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dietToggle, setDietToggle] = useState<'veg' | 'nonveg' | 'any'>('any');
  const [selectedMealTypes, setSelectedMealTypes] = useState<Dish['meal_type'][]>(['breakfast']);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingRecipeToAdd, setPendingRecipeToAdd] = useState<SearchResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMealTypesInModal, setSelectedMealTypesInModal] = useState<Dish['meal_type'][]>(['breakfast']);
  const [dbFilter, setDbFilter] = useState('');
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormValues, setEditFormValues] = useState({ name: '', meal_type: 'breakfast' as Dish['meal_type'], diet_type: 'any' as Dish['diet_type'], ingredients: '', prep_instructions: '' });
  const [addToTodayDishId, setAddToTodayDishId] = useState<string | null>(null);
  const [showAddToTodayModal, setShowAddToTodayModal] = useState(false);
  const [selectedMealForToday, setSelectedMealForToday] = useState<Dish['meal_type']>('breakfast');

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

  const handleMealTypeToggle = (mealType: Dish['meal_type']) => {
    setSelectedMealTypes(prev =>
      prev.includes(mealType)
        ? prev.filter(m => m !== mealType)
        : [...prev, mealType]
    );
  };

  const detectDietType = (name: string, ingredients: string): 'veg' | 'nonveg' => {
    const combined = `${name} ${ingredients}`.toLowerCase();
    return nonVegKeywords.some(keyword => combined.includes(keyword)) ? 'nonveg' : 'veg';
  };

  const searchAIRecipes = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setMessage(null);
    setSearchResults([]);

    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchQuery)}`);
      const payload = await response.json();
      
      let results = (payload.meals as SearchResult[]) || [];
      
      if (dietToggle !== 'any') {
        results = results.filter(meal => {
          const ingredients = Array.from({ length: 20 }, (_, i) => meal[`strIngredient${i + 1}`]).filter(Boolean);
          const detected = detectDietType(meal.strMeal, ingredients.join(' '));
          return detected === dietToggle;
        });
      }

      if (results.length === 0) {
        setMessage(`No recipes found matching "${searchQuery}" and diet preference. Try another search.`);
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      setMessage('Unable to fetch recipes. Try again later.');
    }

    setSearchLoading(false);
  };

  const confirmAddRecipe = async () => {
    const recipe = pendingRecipeToAdd;
    if (!recipe) return;
    if (selectedMealTypesInModal.length === 0) {
      setMessage('Please select at least one meal type.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Please sign in first.');
      return;
    }

    const ingredients = Array.from({ length: 20 }, (_, i) => {
      const ing = recipe[`strIngredient${i + 1}`];
      const measure = recipe[`strMeasure${i + 1}`];
      return ing && ing.trim() ? `${ing.trim()}${measure ? ` (${measure.trim()})` : ''}` : null;
    }).filter(Boolean) as string[];

    const detectedDiet = detectDietType(recipe.strMeal, ingredients.join(' '));

    const { data: existing, error: existErr } = await supabase
      .from('dishes')
      .select('id')
      .ilike('name', recipe.strMeal)
      .limit(1);

    if (existErr) {
      setError(existErr.message);
      return;
    }

    if (existing && existing.length > 0) {
      setMessage(`"${recipe.strMeal}" is already in your database.`);
      setShowAddModal(false);
      setPendingRecipeToAdd(null);
      return;
    }

    for (const mealType of selectedMealTypesInModal) {
      const { error } = await supabase.from('dishes').insert({
        name: recipe.strMeal,
        meal_type: mealType,
        diet_type: detectedDiet,
        ingredients: ingredients,
        prep_instructions: recipe.strInstructions?.slice(0, 500) || null,
      });

      if (error) {
        setError(`Failed to add ${recipe.strMeal}: ${error.message}`);
        return;
      }
    }

    setMessage(`✓ "${recipe.strMeal}" added to database for ${selectedMealTypesInModal.join(', ')}.`);
    setShowAddModal(false);
    setPendingRecipeToAdd(null);
    await loadDishes();
  };

  const openEditModal = (dish: Dish) => {
    setEditDish(dish);
    setEditFormValues({ name: dish.name, meal_type: dish.meal_type, diet_type: dish.diet_type ?? 'any', ingredients: (dish.ingredients || []).join(', '), prep_instructions: dish.prep_instructions ?? '' });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editDish) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Please sign in first.'); return; }
    const payload = { name: editFormValues.name.trim(), meal_type: editFormValues.meal_type, diet_type: editFormValues.diet_type, ingredients: editFormValues.ingredients.split(',').map(s => s.trim()).filter(Boolean), prep_instructions: editFormValues.prep_instructions || null };
    const { error } = await supabase.from('dishes').update(payload).eq('id', editDish.id);
    if (error) { setError(error.message); return; }
    setShowEditModal(false);
    setEditDish(null);
    await loadDishes();
  };

  const openAddToToday = (dishId: string) => { setAddToTodayDishId(dishId); setSelectedMealForToday('breakfast'); setShowAddToTodayModal(true); };

  const confirmAddToToday = async () => {
    if (!addToTodayDishId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Please sign in first.'); return; }
    const todayString = new Date().toISOString().slice(0,10);
    const { error } = await supabase.from('meal_plan').upsert({ user_id: session.user.id, meal_date: todayString, meal_type: selectedMealForToday, dish_id: addToTodayDishId }, { onConflict: 'user_id,meal_date,meal_type' });
    if (error) { setError(error.message); return; }
    setShowAddToTodayModal(false);
    setAddToTodayDishId(null);
    await loadDishes();
  };

  const filteredByDiet = dishes.filter(d => {
    if (dietToggle === 'any') return true;
    return d.diet_type === dietToggle || d.diet_type === 'any';
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Discover Dishes</h1>
              <p className="mt-2 text-sm text-slate-500">
                Search and add recipes to your personal collection. AI-powered filtering helps you find exactly what you want.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {message}
            </div>
          )}

          <div className="mt-6 space-y-6">
            {/* Search Bar */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">AI Recipe Search</h2>
              
              <div className="space-y-4">
                {/* Diet Toggle */}
                <div>
                  <p className="mb-3 text-sm font-medium text-slate-700">Diet Preference</p>
                  <div className="flex gap-2">
                    {dietOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDietToggle(option.value as typeof dietToggle)}
                        className={`rounded-3xl px-4 py-2 text-sm font-semibold transition ${
                          dietToggle === option.value
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meal type selection moved to Add modal (appears when user clicks "Add to Database") */}

                {/* Search Input */}
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    onKeyDown={event => event.key === 'Enter' && searchAIRecipes()}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="Search by ingredient, cuisine, or dish name..."
                  />
                  <button
                    type="button"
                    onClick={searchAIRecipes}
                    className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {searchLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Search Results ({searchResults.length})</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {searchResults.map(recipe => {
                    const ingredients = Array.from({ length: 20 }, (_, i) => recipe[`strIngredient${i + 1}`]).filter(Boolean);
                    const detected = detectDietType(recipe.strMeal, ingredients.join(' '));
                    
                    return (
                      <div key={recipe.idMeal} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        {recipe.strMealThumb && (
                          <img
                            src={recipe.strMealThumb}
                            alt={recipe.strMeal}
                            className="mb-4 h-40 w-full rounded-2xl object-cover"
                          />
                        )}
                        <div>
                          <h4 className="font-semibold text-slate-900">{recipe.strMeal}</h4>
                          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                            {recipe.strArea} · {recipe.strCategory}
                          </p>
                          <div className="mt-3 flex gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              detected === 'veg'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {detected === 'veg' ? 'Veg' : 'Non-Veg'}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-slate-600 line-clamp-2">{recipe.strInstructions?.slice(0, 100)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setPendingRecipeToAdd(recipe); setSelectedMealTypesInModal(['breakfast']); setShowAddModal(true); }}
                          className="mt-4 w-full rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Add to Database
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Your Dishes */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Your Dishes ({filteredByDiet.filter(d => d.name.toLowerCase().includes(dbFilter.toLowerCase())).length})</h2>
          <div className="mt-4 mb-3 flex gap-2">
            <input
              value={dbFilter}
              onChange={e => setDbFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none"
              placeholder="Search your dishes..."
            />
            <button type="button" onClick={() => setDbFilter('')} className="rounded-2xl bg-slate-100 px-3 py-2 text-sm">Clear</button>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading dishes...</p>
          ) : filteredByDiet.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No dishes yet. Search and add some recipes!</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filteredByDiet.filter(d => d.name.toLowerCase().includes(dbFilter.toLowerCase())).map(dish => (
                <div key={dish.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{dish.name}</h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {dish.meal_type} · {dish.diet_type || 'any'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(dish)}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 transition hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openAddToToday(dish.id)}
                        className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Add to today's menu
                      </button>
                    </div>
                  </div>
                  {dish.ingredients && dish.ingredients.length > 0 && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-medium">Key ingredients:</span> {dish.ingredients.slice(0, 3).join(', ')}
                      {dish.ingredients.length > 3 ? '…' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Add to Database modal */}
        {showAddModal && pendingRecipeToAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Add "{pendingRecipeToAdd.strMeal}" to database</h3>
              <p className="mt-2 text-sm text-slate-500">Select meal types to add this dish to.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {mealOptions.slice(0,3).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setSelectedMealTypesInModal(prev => prev.includes(opt.value as Dish['meal_type']) ? prev.filter(p=>p!==opt.value) : [...prev, opt.value as Dish['meal_type']])} className={`rounded-3xl px-4 py-2 ${selectedMealTypesInModal.includes(opt.value as Dish['meal_type']) ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); setPendingRecipeToAdd(null); }} className="rounded-3xl bg-slate-100 px-5 py-3">Cancel</button>
                <button type="button" onClick={confirmAddRecipe} className="rounded-3xl bg-emerald-600 px-5 py-3 text-white">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {showEditModal && editDish && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Edit "{editDish.name}"</h3>
              <div className="mt-4 space-y-3">
                <label className="block text-sm">Name<input value={editFormValues.name} onChange={e=>setEditFormValues(prev=>({...prev, name:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"/></label>
                <label className="block text-sm">Meal type<select value={editFormValues.meal_type} onChange={e=>setEditFormValues(prev=>({...prev, meal_type:e.target.value as Dish['meal_type']}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2">{mealOptions.map(opt=>(<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></label>
                <label className="block text-sm">Diet<select value={editFormValues.diet_type} onChange={e=>setEditFormValues(prev=>({...prev, diet_type:e.target.value as Dish['diet_type']}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2">{dietOptions.map(opt=>(<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></label>
                <label className="block text-sm">Ingredients<textarea value={editFormValues.ingredients} onChange={e=>setEditFormValues(prev=>({...prev, ingredients:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"/></label>
                <label className="block text-sm">Prep<input value={editFormValues.prep_instructions} onChange={e=>setEditFormValues(prev=>({...prev, prep_instructions:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"/></label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={()=>setShowEditModal(false)} className="rounded-3xl bg-slate-100 px-5 py-3">Cancel</button>
                <button type="button" onClick={saveEdit} className="rounded-3xl bg-emerald-600 px-5 py-3 text-white">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Add to Today modal */}
        {showAddToTodayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Add to today's menu</h3>
              <p className="mt-2 text-sm text-slate-500">Select which meal to add this dish to for today.</p>
              <div className="mt-4 flex gap-2">
                {mealOptions.slice(0,3).map(opt=> (
                  <button key={opt.value} type="button" onClick={()=>setSelectedMealForToday(opt.value as Dish['meal_type'])} className={`rounded-3xl px-4 py-2 ${selectedMealForToday===opt.value? 'bg-emerald-600 text-white':'border border-slate-200 bg-white text-slate-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={()=>setShowAddToTodayModal(false)} className="rounded-3xl bg-slate-100 px-5 py-3">Cancel</button>
                <button type="button" onClick={confirmAddToToday} className="rounded-3xl bg-emerald-600 px-5 py-3 text-white">Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
