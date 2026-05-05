/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CityScene } from './components/CityScene';
import { MousePointer2, Car, Star, TreePine, Utensils } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function App() {
  const [score, setScore] = useState(0);
  const [wood, setWood] = useState(0);
  const [hunger, setHunger] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setHunger(prev => {
        const next = prev - 1;
        if (next <= 0) {
          // Game Over logic inside functional state update to access score or handle it without stale closure
          setScore(0);
          return 100;
        }
        return next;
      });
    }, 6000); // 1 per 6s = 10 per minute
    return () => clearInterval(interval);
  }, []);

  const handleEatFood = () => {
     setHunger(prev => Math.min(100, prev + 10));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <CityScene onScore={setScore} onWoodChange={setWood} onEatFood={handleEatFood} />
      
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-white/40">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">3D City Explorer</h1>
          <p className="text-slate-600 flex items-center gap-2 font-medium mb-1">
            <MousePointer2 className="w-5 h-5 text-blue-500" />
            Click ground or use WASD to move
          </p>
          <p className="text-slate-600 flex items-center gap-2 font-medium mb-1">
            <span className="w-5 h-5 font-bold text-indigo-500 flex items-center justify-center border-2 border-indigo-500 rounded-full text-xs">↔</span>
            Drag mouse to rotate camera
          </p>
          <p className="text-slate-600 flex items-center gap-2 font-medium mb-1">
            <span className="w-5 h-5 font-bold text-pink-500 flex items-center justify-center border-2 border-pink-500 rounded-full text-xs">↑</span>
            Press <kbd className="bg-slate-200 px-2 py-0.5 rounded text-sm text-slate-800 font-mono">Space</kbd> to jump over cars
          </p>
          <p className="text-slate-600 flex items-center gap-2 font-medium mb-1">
            <span className="w-5 h-5 font-bold text-sky-500 flex items-center justify-center border-2 border-sky-500 rounded-full text-xs">↑</span>
            Hold <kbd className="bg-slate-200 px-2 py-0.5 rounded text-sm text-slate-800 font-mono">2</kbd> to climb up buildings & trees
          </p>
          <p className="text-slate-600 flex items-center gap-2 font-medium mb-1">
            <TreePine className="w-5 h-5 text-emerald-500" />
            Press <kbd className="bg-slate-200 px-2 py-0.5 rounded text-sm text-slate-800 font-mono">4</kbd> to chop, <kbd className="bg-slate-200 px-2 py-0.5 rounded text-sm text-slate-800 font-mono">6</kbd> to plant tree
          </p>
          <p className="text-slate-600 flex items-center gap-2 font-medium mb-1">
             <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
             Collect Stars to earn points!
          </p>
          <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-slate-200">
             <div className="flex items-center gap-2 text-xl font-bold text-yellow-600">
                <Star className="w-6 h-6 fill-current" />
                Score: {score}
             </div>
             <div className="flex items-center gap-2 text-xl font-bold text-emerald-600">
                <TreePine className="w-6 h-6" />
                Wood: {wood}
             </div>
          </div>
        </div>
      </div>
      
      {/* Right side Overlay for Hunger */}
      <div className="absolute top-6 right-6 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-white/40">
           <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-xl font-bold text-red-500">
                 Hunger: {hunger}/100
                 <Utensils className="w-6 h-6" />
              </div>
              <div className="w-48 h-3 bg-slate-200 rounded-full overflow-hidden">
                 <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${hunger}%` }} />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
