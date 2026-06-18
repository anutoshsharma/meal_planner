'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/20">
        <div className="space-y-7">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-600">Meal Planner PWA</p>
            <h1 className="mt-4 text-4xl font-semibold text-slate-900 sm:text-5xl">Personal meal management for mobile</h1>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Login to manage your dishes, plan the week, search the web for recipes, audit tomorrow's ingredients, and share cook-ready menus with guest mode.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/login"
              className="rounded-3xl bg-emerald-600 px-6 py-4 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Sign in / Sign up
            </Link>
            <Link
              href="/dashboard"
              className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-4 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              View dashboard
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">What you get:</p>
            <ul className="mt-4 space-y-3 pl-5 text-slate-600">
              <li>Basic email/password login</li>
              <li>Search web recipes and save them with ingredients</li>
              <li>In-app dish manager (add, edit, delete)</li>
              <li>7-day sliding meal calendar</li>
              <li>Inventory checklist and quick shopping export</li>
              <li>Guest mode with WhatsApp cook notes</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
