'use client';
import { RotateCcw } from 'lucide-react';
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="container empty-state"><span className="eyebrow">A small interruption</span><h1>Something went wrong.</h1><p>Reload to get back to the gallery.</p><button className="button" onClick={reset}><RotateCcw size={17}/>Try again</button></div>; }
