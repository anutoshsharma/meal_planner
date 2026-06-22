'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import { generateRecipeWithAI } from '@/app/actions/chef';

interface Dish {
  id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'any';
  diet_type?: 'any' | 'veg' | 'nonveg';
  core_ingredients?: string[] | null;
  ingredients?: string[] | null;
  prep_instructions?: string | null;
  instructions?: string | null;
}

interface GeneratedRecipe {
  name: string;
  core_ingredients: string[];
  ingredients: string[];
  prep_instructions: string;
  instructions_to_cook: string;
  category: string;
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

const indianChefs = ['Any', 'Sanjeev Kapoor', 'Ranveer Brar', 'Kunal Kapur', 'Vikas Khanna', 'Tarla Dalal', 'Nisha Madhulika', 'Kabita Singh', 'Hebbars Kitchen', 'MadhurasRecipe', 'Chef Ashok'];
const cuisines = ['Indian', 'Mexican', 'Italian', 'Chinese', 'Continental', 'Thai', 'Middle Eastern', 'American'];

export default function DishesPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeneratedRecipe[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dietToggle, setDietToggle] = useState<'veg' | 'nonveg' | 'any'>('any');
  const [selectedChef, setSelectedChef] = useState('Any');
  const [selectedCuisine, setSelectedCuisine] = useState('Indian');

  const [viewAIDish, setViewAIDish] = useState<GeneratedRecipe | null>(null);
  const [viewDbDish, setViewDbDish] = useState<Dish | null>(null);
  const [selectedMealTypesInModal, setSelectedMealTypesInModal] = useState<Dish['meal_type'][]>(['lunch']);
  
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [editFormValues, setEditFormValues] = useState({ name: '', meal_type: 'breakfast' as Dish['meal_type'], diet_type: 'any' as Dish['diet_type'], core_ingredients: '', ingredients: '', prep_instructions: '', instructions: '' });
  
  const [addToTodayDishId, setAddToTodayDishId] = useState<string | null>(null);
  const [selectedMealForToday, setSelectedMealForToday] = useState<Dish['meal_type']>('breakfast');
  const [dbFilter, setDbFilter] = useState('');

  useEffect(() => {
    loadDishes();
  }, []);

  async function loadDishes() {
    setLoading(true);
    const { data, error } = await supabase.from('dishes').select('*').order('name', { ascending: true });
    if (error) setError(error.message);
    else if (data) setDishes(data);
    setLoading(false);
  }

  const searchAIRecipes = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setMessage(null);
    setSearchResults([]);

    const response = await generateRecipeWithAI(searchQuery, dietToggle, selectedChef, selectedCuisine);
    
    if (response.success && response.data) {
      // Now response.data is an array of 3 recipes
      setSearchResults(response.data);
    } else {
      setMessage(response.error || 'Could not generate dishes. Try different ingredients.');
    }
    setSearchLoading(false);
  };

  const confirmAddRecipe = async () => {
    if (!viewAIDish) return;
    if (selectedMealTypesInModal.length === 0) {
      setMessage('Please select at least one meal type.');
      return;
    }

    // IF MULTIPLE MEALS ARE SELECTED, WE SAVE IT AS A SINGLE "ANY" ENTRY TO PREVENT DUPLICATES
    const finalMealType = selectedMealTypesInModal.length > 1 ? 'any' : selectedMealTypesInModal[0];

    const { error } = await supabase.from('dishes').insert({
      name: viewAIDish.name,
      meal_type: finalMealType,
      diet_type: dietToggle === 'any' ? 'veg' : dietToggle,
      core_ingredients: viewAIDish.core_ingredients,
      ingredients: viewAIDish.ingredients,
      prep_instructions: viewAIDish.prep_instructions,
      instructions: viewAIDish.instructions_to_cook,
    });

    if (error) {
      setError(`Failed to add: ${error.message}`);
      return;
    }

    setMessage(`✓ "${viewAIDish.name}" added to database as ${finalMealType}!`);
    setViewAIDish(null);
    setSelectedMealTypesInModal(['lunch']); // Reset
    await loadDishes();
  };

  const saveEdit = async () => {
    if (!editDish) return;
    const payload = { 
      name: editFormValues.name.trim(), 
      meal_type: editFormValues.meal_type, 
      diet_type: editFormValues.diet_type, 
      core_ingredients: editFormValues.core_ingredients.split(',').map(s => s.trim()).filter(Boolean),
      ingredients: editFormValues.ingredients.split(',').map(s => s.trim()).filter(Boolean), 
      prep_instructions: editFormValues.prep_instructions || null,
      instructions: editFormValues.instructions || null
    };
    const { error } = await supabase.from('dishes').update(payload).eq('id', editDish.id);
    if (error) setError(error.message);
    else {
      setEditDish(null);
      await loadDishes();
    }
  };

  const confirmAddToToday = async () => {
    if (!addToTodayDishId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Please sign in first.'); return; }
    
    const todayString = new Date().toISOString().slice(0,10);
    const { error } = await supabase.from('meal_plan').upsert(
      { user_id: session.user.id, meal_date: todayString, meal_type: selectedMealForToday, dish_id: addToTodayDishId }, 
      { onConflict: 'user_id,meal_date,meal_type' }
    );
    
    if (error) setError(error.message);
    else {
      setAddToTodayDishId(null);
      setMessage('Added to today\'s menu!');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Discover Dishes</h1>
          <p className="mt-2 text-sm text-slate-500">Search by ingredients, cuisine, or dish name. The AI will generate multiple options.</p>

          {(error || message) && (
            <div className={`mt-5 rounded-2xl px-4 py-3 text-sm flex justify-between ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              <span>{error || message}</span>
              <button onClick={() => {setError(null); setMessage(null)}} className="underline ml-2">Dismiss</button>
            </div>
          )}

          <div className="mt-6 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Diet Preference</label>
                  <select value={dietToggle} onChange={e => setDietToggle(e.target.value as any)} className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none">
                    {dietOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuisine</label>
                  <select value={selectedCuisine} onChange={e => setSelectedCuisine(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none">
                    {cuisines.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">By Chef Style</label>
                  <select value={selectedChef} onChange={e => setSelectedChef(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none">
                    {indianChefs.map(chef => <option key={chef} value={chef}>{chef}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && searchAIRecipes()}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  placeholder="e.g., 'Paneer and Capsicum' or 'Biryani'"
                />
                <button type="button" onClick={searchAIRecipes} disabled={searchLoading} className="rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70">
                  {searchLoading ? 'Thinking…' : 'Search'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {searchResults.map((recipe, idx) => (
                  <div key={idx} onClick={() => setViewAIDish(recipe)} className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400 transition group flex flex-col h-full">
                    <img
                      src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=250&fit=crop" 
                      alt="Food Placeholder"
                      className="mb-4 h-40 w-full rounded-2xl object-cover group-hover:opacity-90 transition"
                    />
                    <div className="flex-grow">
                      <h4 className="font-semibold text-lg text-slate-900">{recipe.name}</h4>
                      <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{recipe.category}</p>
                      
                      <div className="mt-3 flex flex-wrap gap-1">
                        {recipe.core_ingredients.slice(0,3).map((ing, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{ing}</span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                      <span className="text-sm font-medium text-emerald-600 group-hover:underline">View Details &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">All Dishes</h2>
          </div>
          
          <input
            value={dbFilter}
            onChange={e => setDbFilter(e.target.value)}
            className="w-full mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Search your saved dishes..."
          />

          {loading ? (
            <p className="text-sm text-slate-500">Loading dishes...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dishes.filter(d => d.name.toLowerCase().includes(dbFilter.toLowerCase())).map(dish => (
                <div key={dish.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">{dish.name}</h3>
                    <div className="mt-2 flex gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">{dish.meal_type}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">{dish.diet_type || 'any'}</span>
                    </div>
                    {dish.core_ingredients && dish.core_ingredients.length > 0 && (
                      <p className="mt-3 text-xs text-slate-500 font-medium">Core: {dish.core_ingredients.join(', ')}</p>
                    )}
                  </div>
                  
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button onClick={() => setViewDbDish(dish)} className="rounded-2xl bg-indigo-50 text-indigo-700 px-3 py-2 text-xs font-semibold transition hover:bg-indigo-100 flex-1 text-center">
                      View
                    </button>
                    <button onClick={() => {
                        setEditDish(dish);
                        setEditFormValues({ name: dish.name, meal_type: dish.meal_type, diet_type: dish.diet_type || 'any', core_ingredients: (dish.core_ingredients || []).join(', '), ingredients: (dish.ingredients || []).join(', '), prep_instructions: dish.prep_instructions || '', instructions: dish.instructions || '' });
                      }} className="rounded-2xl bg-slate-100 text-slate-700 px-3 py-2 text-xs font-semibold transition hover:bg-slate-200 flex-1 text-center">
                      Edit
                    </button>
                    <button onClick={() => { setAddToTodayDishId(dish.id); setSelectedMealForToday(dish.meal_type === 'any' ? 'lunch' : dish.meal_type); }} className="rounded-2xl bg-emerald-600 text-white px-3 py-2 text-xs font-semibold transition hover:bg-emerald-700 w-full mt-2">
                      + Add to Today's Menu
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* MODALS */}
        {viewAIDish && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{viewAIDish.name}</h3>
                  <p className="text-sm text-slate-500 uppercase tracking-widest mt-1">{viewAIDish.category} · {selectedChef !== 'Any' ? `${selectedChef} Style` : 'Classic'}</p>
                </div>
                <button onClick={() => setViewAIDish(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">&times;</button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <h4 className="font-semibold text-slate-900 mb-2">Core Ingredients</h4>
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {viewAIDish.core_ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                    </ul>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <h4 className="font-semibold text-orange-900 mb-2">Night-Before Prep</h4>
                    <p className="text-sm text-orange-800">{viewAIDish.prep_instructions || 'None required.'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 border-b pb-2 mb-2">All Ingredients</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{viewAIDish.ingredients.join(', ')}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 border-b pb-2 mb-2">Cooking Instructions</h4>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{viewAIDish.instructions_to_cook}</p>
                </div>
              </div>

              <div className="mt-8 border-t pt-6">
                <p className="text-sm font-medium mb-3">Save to your database for which meals? <span className="text-slate-400 font-normal">(Multiple selections will save as "Any")</span></p>
                <div className="flex gap-2 mb-4">
                  {mealOptions.slice(0,3).map(opt => (
                    <button key={opt.value} onClick={() => setSelectedMealTypesInModal(prev => prev.includes(opt.value as Dish['meal_type']) ? prev.filter(p=>p!==opt.value) : [...prev, opt.value as Dish['meal_type']])} className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedMealTypesInModal.includes(opt.value as Dish['meal_type']) ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={confirmAddRecipe} className="w-full rounded-full bg-emerald-600 px-6 py-4 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700">
                  Save Recipe to My Dishes
                </button>
              </div>
            </div>
          </div>
        )}

        {viewDbDish && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{viewDbDish.name}</h3>
                  <div className="mt-2 flex gap-2">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase text-indigo-700">{viewDbDish.meal_type}</span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">{viewDbDish.diet_type || 'any'}</span>
                  </div>
                </div>
                <button onClick={() => setViewDbDish(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">&times;</button>
              </div>

              <div className="space-y-6">
                {viewDbDish.core_ingredients && viewDbDish.core_ingredients.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <h4 className="font-semibold text-slate-900 mb-2">Core Ingredients</h4>
                    <p className="text-sm text-slate-700">{viewDbDish.core_ingredients.join(', ')}</p>
                  </div>
                )}
                
                {viewDbDish.prep_instructions && (
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <h4 className="font-semibold text-orange-900 mb-2">Night-Before Prep</h4>
                    <p className="text-sm text-orange-800">{viewDbDish.prep_instructions}</p>
                  </div>
                )}

                {viewDbDish.ingredients && viewDbDish.ingredients.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 border-b pb-2 mb-2">All Ingredients</h4>
                    <p className="text-sm text-slate-700">{viewDbDish.ingredients.join(', ')}</p>
                  </div>
                )}

                {viewDbDish.instructions && (
                  <div>
                    <h4 className="font-semibold text-slate-900 border-b pb-2 mb-2">Cooking Instructions</h4>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{viewDbDish.instructions}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {editDish && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Edit "{editDish.name}"</h3>
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium">Name<input value={editFormValues.name} onChange={e=>setEditFormValues(prev=>({...prev, name:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-normal"/></label>
                <div className="flex gap-4">
                  <label className="block text-sm font-medium w-full">Meal type<select value={editFormValues.meal_type} onChange={e=>setEditFormValues(prev=>({...prev, meal_type:e.target.value as Dish['meal_type']}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-normal">{mealOptions.map(opt=>(<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></label>
                  <label className="block text-sm font-medium w-full">Diet<select value={editFormValues.diet_type} onChange={e=>setEditFormValues(prev=>({...prev, diet_type:e.target.value as Dish['diet_type']}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-normal">{dietOptions.map(opt=>(<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></label>
                </div>
                <label className="block text-sm font-medium">Core Ingredients (comma separated)<input value={editFormValues.core_ingredients} onChange={e=>setEditFormValues(prev=>({...prev, core_ingredients:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-normal"/></label>
                <label className="block text-sm font-medium">All Ingredients (comma separated)<textarea rows={2} value={editFormValues.ingredients} onChange={e=>setEditFormValues(prev=>({...prev, ingredients:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-normal"/></label>
                <label className="block text-sm font-medium">Night-Before Prep<input value={editFormValues.prep_instructions} onChange={e=>setEditFormValues(prev=>({...prev, prep_instructions:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-normal"/></label>
                <label className="block text-sm font-medium">Cooking Instructions<textarea rows={4} value={editFormValues.instructions} onChange={e=>setEditFormValues(prev=>({...prev, instructions:e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-normal"/></label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={()=>setEditDish(null)} className="rounded-3xl bg-slate-100 px-5 py-3 text-sm font-medium">Cancel</button>
                <button onClick={saveEdit} className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {addToTodayDishId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Add to today's menu</h3>
              <p className="mt-2 text-sm text-slate-500 mb-4">Select which meal to add this dish to.</p>
              <div className="flex flex-col gap-2">
                {mealOptions.slice(0,3).map(opt=> (
                  <button key={opt.value} onClick={()=>setSelectedMealForToday(opt.value as Dish['meal_type'])} className={`rounded-2xl px-4 py-3 font-medium transition ${selectedMealForToday===opt.value? 'bg-emerald-600 text-white':'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={()=>setAddToTodayDishId(null)} className="w-full rounded-full bg-slate-100 px-4 py-3 text-sm font-medium">Cancel</button>
                <button onClick={confirmAddToToday} className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-medium text-white">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}