'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

interface PlannedMeal {
  meal_type: string;
  dishes: {
    name: string;
    core_ingredients: any;
    ingredients: any;
    prep_instructions: string | null;
  };
}

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<'today' | 'tomorrow'>('tomorrow');
  
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [prepTasks, setPrepTasks] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInventory(targetDate);
  }, [targetDate]);

  // Helper to safely parse ingredients whether they are a real array or a raw CSV string like "{Paneer, Tomato}"
  const parseIngredients = (ings: any): string[] => {
    if (!ings) return [];
    if (Array.isArray(ings)) return ings;
    if (typeof ings === 'string') {
      return ings.replace(/^\{|\}$/g, '').split(',').map(i => i.trim());
    }
    return [];
  };

  async function loadInventory(dateMode: 'today' | 'tomorrow') {
    setLoading(true);
    setError(null);
    setCheckedItems(new Set()); // Reset checks when switching days

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Please sign in to view your inventory.");
        setLoading(false);
        return;
      }

      // Calculate the date string (YYYY-MM-DD)
      const dateObj = new Date();
      if (dateMode === 'tomorrow') {
        dateObj.setDate(dateObj.getDate() + 1);
      }
      const dateString = dateObj.toISOString().slice(0, 10);

      // Fetch the meal plan AND join the dishes table (now including full 'ingredients')
      const { data, error: fetchError } = await supabase
        .from('meal_plan')
        .select(`
          meal_type,
          dishes (
            name,
            core_ingredients,
            ingredients,
            prep_instructions
          )
        `)
        .eq('user_id', session.user.id)
        .eq('meal_date', dateString);

      if (fetchError) throw fetchError;

      const meals = (data || []) as unknown as PlannedMeal[];
      setPlannedMeals(meals);

      const allIngredients = new Set<string>();
      const allPrepTasks: string[] = [];

      meals.forEach(meal => {
        // Handle potential array wrapping from Supabase joins
        const dishData = Array.isArray(meal.dishes) ? meal.dishes[0] : meal.dishes;
        
        if (dishData) {
          // Parse both core and full ingredients
          const fullIngs = parseIngredients(dishData.ingredients);
          const coreIngs = parseIngredients(dishData.core_ingredients);
          
          fullIngs.forEach(ing => ing && allIngredients.add(ing));
          coreIngs.forEach(ing => ing && allIngredients.add(ing));

          if (dishData.prep_instructions && dishData.prep_instructions.trim() !== '') {
            allPrepTasks.push(`For ${dishData.name}: ${dishData.prep_instructions}`);
          }
        }
      });

      setIngredients(Array.from(allIngredients).sort());
      setPrepTasks(allPrepTasks);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleCheck = (ingredient: string) => {
    const newSet = new Set(checkedItems);
    if (newSet.has(ingredient)) {
      newSet.delete(ingredient);
    } else {
      newSet.add(ingredient);
    }
    setCheckedItems(newSet);
  };

  const copyMissingItems = () => {
    const missing = ingredients.filter(ing => !checkedItems.has(ing));
    if (missing.length === 0) {
      alert("You have everything!");
      return;
    }
    const textToCopy = `Groceries needed:\n- ${missing.join('\n- ')}`;
    navigator.clipboard.writeText(textToCopy);
    alert("Missing items copied to clipboard! Paste it into your delivery app.");
  };

  const displayDate = () => {
    const d = new Date();
    if (targetDate === 'tomorrow') d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* --- HEADER & TOGGLE --- */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Inventory Checklist</h1>
            <p className="mt-1 text-sm text-slate-500">Checking requirements for: <strong className="text-slate-700">{displayDate()}</strong></p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-full w-full md:w-auto">
            <button 
              onClick={() => setTargetDate('today')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-full text-sm font-medium transition ${targetDate === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Today
            </button>
            <button 
              onClick={() => setTargetDate('tomorrow')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-full text-sm font-medium transition ${targetDate === 'tomorrow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Tomorrow
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 pl-2">Scanning your menu...</p>
        ) : plannedMeals.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <h3 className="text-lg font-medium text-slate-900">No meals planned</h3>
            <p className="mt-2 text-sm text-slate-500">You haven't assigned any dishes for {targetDate}. Go to the Dishes page to add some!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-12">
            
            {/* LEFT COLUMN: THE CHECKLIST */}
            <div className="md:col-span-8 space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-slate-900">All Ingredients Needed</h2>
                  <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {checkedItems.size} / {ingredients.length} Collected
                  </span>
                </div>
                
                {ingredients.length === 0 ? (
                  <p className="text-sm text-slate-500">No ingredients listed for these meals.</p>
                ) : (
                  <div className="space-y-2">
                    {ingredients.map((ing, idx) => {
                      const isChecked = checkedItems.has(ing);
                      return (
                        <div 
                          key={idx} 
                          onClick={() => toggleCheck(ing)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition ${isChecked ? 'bg-emerald-50/50 border-emerald-100 text-slate-400' : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-800'}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}>
                            {isChecked && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className={`text-base font-medium ${isChecked ? 'line-through' : ''}`}>
                            {ing}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={copyMissingItems}
                    disabled={ingredients.length === 0 || checkedItems.size === ingredients.length}
                    className="flex-1 rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Copy Missing Items to Clipboard
                  </button>
                  <button 
                    onClick={() => setCheckedItems(new Set(ingredients))}
                    disabled={ingredients.length === 0}
                    className="flex-1 rounded-full bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Mark All as Collected
                  </button>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: PREP & CONTEXT */}
            <div className="md:col-span-4 space-y-6">
              
              {/* Prep Box */}
              <section className="rounded-3xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
                  <span>🌙</span> Night-Before Prep
                </h3>
                {prepTasks.length === 0 ? (
                  <p className="text-sm text-orange-800/70 italic">No advance prep required for this menu.</p>
                ) : (
                  <ul className="space-y-3">
                    {prepTasks.map((task, idx) => (
                      <li key={idx} className="text-sm text-orange-800 bg-white/60 p-3 rounded-xl border border-orange-100/50">
                        {task}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Menu Context Box */}
              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <span>📋</span> Menu Overview
                </h3>
                <div className="space-y-4">
                  {['breakfast', 'lunch', 'dinner', 'any'].map(mealType => {
                    const dish = plannedMeals.find(m => m.meal_type === mealType);
                    if (!dish) return null;
                    
                    // Supabase array wrapping check
                    const actualDish = Array.isArray(dish.dishes) ? dish.dishes[0] : dish.dishes;

                    return (
                      <div key={mealType}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{mealType}</p>
                        <p className="text-sm font-medium text-slate-900">{actualDish?.name}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}