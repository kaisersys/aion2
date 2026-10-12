import React from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from '@supabase/supabase-js';
import { StudioEditor } from './admin/AdminPanel';
import './style.css';

const user={id:'00000000-0000-0000-0000-000000000001'} as User;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="site">
      <main className="inner-page section-wrap studio-page">
        <StudioEditor record={null} user={user} onSaved={()=>{}} onCancel={()=>{}}/>
      </main>
    </div>
  </React.StrictMode>
);
