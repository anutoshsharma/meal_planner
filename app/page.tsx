'use client';

import Image from 'next/image';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.push('/login');
    }, 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="flex h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        <div className="w-36 h-36">
          <Image src="/logo.svg" alt="Meal Planner" width={144} height={144} priority />
        </div>
        <p className="text-sm text-slate-600">Welcome to Meal Planner</p>
      </div>
    </main>
  );
}
