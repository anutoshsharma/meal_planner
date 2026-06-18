'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

// Simple TypeScript definition for our dishes
interface Dish {
  id: string;
  name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'any';
  prep_instructions?: string;
}

export default function Home() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [breakfast, setBreakfast] = useState<Dish | null>(null);
  const [lunch, setLunch] = useState<Dish | null>(null);
  const [dinner, setDinner] = useState<Dish | null>(null);

  // 1. Fetch available dishes from Supabase on load
  useEffect(() => {
    async function fetchDishes() {
      const { data, error } = await supabase.from('dishes').select('*');
      if (data && !error) {
        setDishes(data);
        // Pick initial random selections for the day
        const bList = data.filter(d => d.meal_type === 'breakfast' || d.meal_type === 'any');
        const lList = data.filter(d => d.meal_type === 'lunch' || d.meal_type === 'any');
        const dList = data.filter(d => d.meal_type === 'dinner' || d.meal_type === 'any');
        
        if (bList.length) setBreakfast(bList[0]);
        if (lList.length) setLunch(lList[0]);
        if (dList.length) setDinner(dList[0]);
      }
    }
    fetchDishes();
  }, []);

  // 2. Simple rotation logic: Grab a random dish from the pool matching the meal type
  const shuffleMeal = (type: 'breakfast' | 'lunch' | 'dinner') => {
    const pool = dishes.filter(d => d.meal_type === type || d.meal_type === 'any');
    if (pool.length === 0) return;
    const randomDish = pool[Math.floor(Math.random() * pool.length)];
    if (type === 'breakfast') setBreakfast(randomDish);
    if (type === 'lunch') setLunch(randomDish);
    if (type === 'dinner') setDinner(randomDish);
  };

  // 3. Free WhatsApp Broadcast Generator
  const sendToCook = () => {
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
    const message = `*Menu for ${today}*\n\n` +
                    `☀️ *Breakfast:* ${breakfast?.name || 'Not planned'}\n` +
                    `🕛 *Lunch:* ${lunch?.name || 'Not planned'}\n` +
                    `🌙 *Dinner:* ${dinner?.name || 'Not planned'}\n\n` +
                    `_Sent via KitchenOps_`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // 4. Compute Advanced Actions for the User
  const prepsNeeded = [breakfast, lunch, dinner]
    .filter(dish => dish?.prep_instructions)
    .map(dish => dish?.prep_instructions);

  return (
    <main className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto font-sans">
      <header className="mb-6 pt-4">
        <h1 className="text-2xl font-bold text-slate-800">KitchenOps 🍳</h1>
        <p className="text-sm text-slate-500">Simplify your daily meal delegation</p>
      </header>

      {/* Advanced Action Banner for User Prep */}
      {prepsNeeded.length > 0 && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
          <h3 className="font-semibold text-amber-800 text-sm mb-1">⚠️ Tonight's Prep Work Needed:</h3>
          <ul className="list-disc list-inside text-xs text-amber-700 space-y-1">
            {prepsNeeded.map((prep, idx) => (
              <li key={idx}>{prep}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Menu Planner Slots */}
      <div className="space-y-4 mb-8">
        {[
          { label: '☀️ Breakfast', current: breakfast, type: 'breakfast' as const },
          { label: '🕛 Lunch', current: lunch, type: 'lunch' as const },
          { label: '🌙 Dinner', current: dinner, type: 'dinner' as const }
        ].map((slot) => (
          <div key={slot.type} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{slot.label}</span>
              <p className="text-lg font-medium text-slate-800 mt-1">{slot.current?.name || 'Empty slot'}</p>
            </div>
            <button 
              onClick={() => shuffleMeal(slot.type)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs px-3 py-2 rounded-lg font-medium transition"
            >
              🔄 Shuffle
            </button>
          </div>
        ))}
      </div>

      {/* Primary Action Call */}
      <button 
        onClick={sendToCook}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition flex justify-center items-center gap-2"
      >
        <span>Send Menu to Cook via WhatsApp</span>
      </button>
    </main>
  );
}