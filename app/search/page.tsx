'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'any';
type DietType = 'any' | 'veg' | 'nonveg';

interface SearchResult {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  [key: string]: any;
}

const defaultMealType: Record<string, MealType> = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
};

const dietOptions: {value: DietType; label: string}[] = [
  { value: 'any', label: 'Any' },
  { value: 'veg', label: 'Veg' },
  { value: 'nonveg', label: 'Non-Veg' },
];

const nonVegKeywords = [
  'chicken',
  'mutton',
  'goat',
  'beef',
  'pork',
  'fish',
  'egg',
  'shrimp',
  'prawn',
  'crab',
  'lobster',
  'duck',
  'seafood',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('any');
  const [selectedDietType, setSelectedDietType] = useState<DietType>('any');

  const isNonVegMeal = (meal: SearchResult) => {
    const ingredients = getIngredients(meal).join(' ').toLowerCase();
    const name = meal.strMeal.toLowerCase();
    const target = `${name} ${ingredients}`;
    return nonVegKeywords.some(keyword => target.includes(keyword));
  };

  const matchesDietFilter = (meal: SearchResult) => {
    if (selectedDietType === 'any') return true;
    const nonVeg = isNonVegMeal(meal);
    return selectedDietType === 'veg' ? !nonVeg : nonVeg;
  };

  const searchDishes = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
      const payload = await response.json();
      if (!payload || !payload.meals) {
        setResults([]);
        setMessage('No results found for that dish.');
      } else {
        const searchResults = payload.meals as SearchResult[];
        const indianResults = searchResults.filter(result => result.strArea?.toLowerCase() === 'indian');
        const filteredResults = indianResults.filter(matchesDietFilter);

        setResults(filteredResults);
        if (filteredResults.length === 0) {
          setMessage(
            indianResults.length === 0
              ? 'No Indian recipes found for that search. Try a broader query or search for another dish.'
              : `No ${selectedDietType === 'veg' ? 'vegetarian' : selectedDietType === 'nonveg' ? 'non-vegetarian' : ''} Indian recipes found.`
          );
        }
      }
    } catch (error) {
      setMessage('Unable to reach recipe search. Try again later.');
    }

    setLoading(false);
  };

  const getIngredients = (meal: SearchResult) => {
    return Array.from({ length: 20 }, (_, index) => {
      const ingredient = meal[`strIngredient${index + 1}`];
      const measure = meal[`strMeasure${index + 1}`];
      return ingredient && ingredient.trim() ? `${ingredient.trim()}${measure ? ` (${measure.trim()})` : ''}` : null;
    }).filter(Boolean) as string[];
  };

  const addDish = async (meal: SearchResult) => {
    setMessage(null);
    const ingredients = getIngredients(meal);
    const type = selectedMealType ?? 'any';

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage('Please sign in first.');
      return;
    }

    const { error } = await supabase.from('dishes').insert({
      name: meal.strMeal,
      meal_type: type,
      diet_type: selectedDietType,
      ingredients,
      prep_instructions: meal.strInstructions?.slice(0, 250) ?? null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${meal.strMeal} was added to your dish database.`);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Search dishes from the web</h1>
          <p className="mt-2 text-sm text-slate-500">Find recipes and add them to your personal database with ingredients and meal type.</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && searchDishes()}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Search for a dish name, e.g. Biryani"
            />
            <button
              type="button"
              onClick={searchDishes}
              className="rounded-3xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
              disabled={!query.trim() || loading}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-slate-600">Save search results as:</span>
            <div className="flex flex-wrap gap-3">
              <select
                value={selectedMealType}
                onChange={event => setSelectedMealType(event.target.value as MealType)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="any">Any meal</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
              <select
                value={selectedDietType}
                onChange={event => setSelectedDietType(event.target.value as DietType)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                {dietOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          )}
        </section>

        <section className="space-y-4">
          {results.map(result => (
            <div key={result.idMeal} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{result.strArea}</span>
                    <span>•</span>
                    <span>{result.strCategory}</span>
                    <span>•</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                      {matchesDietFilter(result) ? (isNonVegMeal(result) ? 'Non-Veg' : 'Veg') : 'Filtered'}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">{result.strMeal}</h2>
                  <p className="text-sm leading-6 text-slate-600">{result.strInstructions?.slice(0, 180) ?? 'No description available.'}</p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {getIngredients(result).slice(0, 5).map((ingredient, index) => (
                      <span key={index} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
                        {ingredient}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3">
                  {result.strMealThumb && (
                    <img src={result.strMealThumb} alt={result.strMeal} className="h-32 w-32 rounded-3xl object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => addDish(result)}
                    className="rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Add to my dishes
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
