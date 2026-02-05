import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getBook, updateBookProgress, saveHighlight, deleteHighlight, updateReadingStats, saveChapterSummary } from '../services/db';
import BookView from '../components/BookView';
import { summarizeChapter } from '../services/ai'; 

import { 
  Moon, Sun, BookOpen, Scroll, Type, 
  ChevronLeft, Menu, X, List, Trash2, Clock, 
  Search as SearchIcon, ChevronUp, ChevronDown, Sparkles, Wand2, User
} from 'lucide-react';

export default function Reader() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get('id');
  const [book, setBook] = useState(null);
  
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSearchMenu, setShowSearchMenu] = useState(false); 
  const [showAIModal, setShowAIModal] = useState(false); 
  const [isSummarizing, setIsSummarizing] = useState(false); 
  const [sidebarTab, setSidebarTab] = useState('chapters'); 
  const [toc, setToc] = useState([]);
  const [jumpTarget, setJumpTarget] = useState(null);
  const [rendition, setRendition] = useState(null);
  const [modalContext, setModalContext] = useState(null);
  
  const [pageCounter, setPageCounter] = useState(0);
  const [intermediateSummaries, setIntermediateSummaries] = useState([]);

  useEffect(() => {
    if (showAIModal && rendition) {
      try {
        const loc = rendition.currentLocation();
        if (loc && loc.start) {
          const currentIndex = loc.start.index;
          // Extract chapter label from TOC
          const chapterLabel = toc.find(t => t.href.includes(loc.start.href))?.label || `Section ${currentIndex + 1}`;
          const prevSpineItem = currentIndex > 0 ? rendition.book.spine.get(currentIndex - 1) : null;
          
          setModalContext({
            chapterLabel,
            index: currentIndex,
            total: rendition.book.spine.length,
            prevHref: prevSpineItem ? prevSpineItem.href : null
          });
        }
      } catch (err) { console.error(err); }
    }
  }, [showAIModal, rendition, toc]);

  const handleLocationChange = (loc) => {
    if (!loc?.start || !bookId) return;
    updateBookProgress(bookId, loc.start.cfi, loc.percentage || 0);

    setPageCounter(prev => {
      const next = prev + 1;
      if (next >= 4) { 
        triggerIntermediateSummary();
        return 0;
      }
      return next;
    });
  };

  const triggerIntermediateSummary = async () => {
    if (!rendition || isSummarizing) return;
    try {
      const viewer = rendition.getContents()[0];
      const pageText = viewer.document.body.innerText;
      const memory = [...intermediateSummaries, book?.globalSummary].filter(Boolean).join("\n");
      const snippet = await summarizeChapter(pageText, memory, "background-intermediate");
      if (snippet) setIntermediateSummaries(prev => [...prev, snippet]);
    } catch (e) { console.error(e); }
  };

  const handleChapterEnd = async (chapterHref, rawText) => {
    if (!book || isSummarizing) return;
    const alreadySummarized = book.aiSummaries?.some(s => s.chapterHref === chapterHref);
    if (alreadySummarized) return;

    setIsSummarizing(true);
    try {
        const combinedContext = [book.globalSummary, ...intermediateSummaries].filter(Boolean).join("\n");
        const finalChapterSummary = await summarizeChapter(rawText, combinedContext, "chapter-final");
        if (finalChapterSummary) {
            const updatedGlobal = book.globalSummary ? `${book.globalSummary}\n\n${finalChapterSummary}` : finalChapterSummary;
            const updatedBook = await saveChapterSummary(book.id, chapterHref, finalChapterSummary, updatedGlobal);
            if (updatedBook) {
              setBook(updatedBook);
              setIntermediateSummaries([]); 
            }
        }
    } catch (err) { console.error(err); } finally { setIsSummarizing(false); }
  };

  const handleManualPageSummary = async () => {
    if (!rendition || !book) return;
    setIsSummarizing(true);
    setShowAIModal(true);

    try {
      const viewer = rendition.getContents()[0];
      const pageText = viewer.document.body.innerText;
      const combinedContext = [book.globalSummary, ...intermediateSummaries].filter(Boolean).join("\n");
      const pageSummary = await summarizeChapter(pageText, combinedContext, "manual-page");
      
      if (pageSummary) {
        const updatedGlobal = book.globalSummary ? `${book.globalSummary}\n\n${pageSummary}` : pageSummary;
        const updatedBook = await saveChapterSummary(book.id, `manual-${Date.now()}`, pageSummary, updatedGlobal);
        if (updatedBook) setBook(updatedBook);
      }
    } catch (err) { console.error(err); } finally { setIsSummarizing(false); }
  };

  useEffect(() => {
    const loadBook = async () => { if (bookId) setBook(await getBook(bookId)); };
    loadBook();
  }, [bookId]);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('reader-settings');
    return saved ? JSON.parse(saved) : { fontSize: 100, theme: 'light', flow: 'paginated' };
  });

  if (!book) return <div className="p-10 text-center dark:bg-gray-900 dark:text-gray-400">Loading...</div>;

  return (
    <div className={`h-screen flex flex-col overflow-hidden transition-colors duration-200 ${settings.theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
      
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(70px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(70px) rotate(-360deg); }
        }
        .char-icon { position: absolute; animation: orbit 5s linear infinite; }
      `}</style>

      {showAIModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowAIModal(false)} />
          <div className={`relative w-full max-w-lg p-8 rounded-3xl shadow-2xl animate-in zoom-in duration-200 ${settings.theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
            
            {isSummarizing ? (
              <div className="flex flex-col items-center justify-center py-10 min-h-[300px] relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="char-icon" style={{ animationDelay: `-${i * 1}s` }}>
                      <User className="text-blue-400/50" size={20} />
                    </div>
                  ))}
                </div>
                <Sparkles className="text-blue-500 animate-spin mb-6" size={40} />
                <p className="text-sm font-bold tracking-widest uppercase animate-pulse">Consulting the Muses...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
                  <h3 className="text-lg font-black text-blue-500 uppercase tracking-tighter">
                    You are reading {modalContext?.chapterLabel}
                  </h3>
                  <button onClick={() => setShowAIModal(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>

                <div className="max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  {(() => {
                    const content = book.aiSummaries?.find(s => s.chapterHref.includes(modalContext?.prevHref))?.summary 
                                  || book.aiSummaries?.[book.aiSummaries.length - 1]?.summary 
                                  || "Summary:\nYour story is unfolding. Read more to see the analysis.";
                    
                    const [summaryPart, charPart] = content.split(/Characters so far:/i);

                    return (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <h4 className="text-xs font-black text-gray-400 uppercase mb-2">Summary :</h4>
                          <div className="italic leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {summaryPart.replace(/Summary:/i, '').trim()}
                          </div>
                        </div>

                        {charPart && (
                          <div className="pt-4 border-t dark:border-gray-700">
                            <h4 className="text-xs font-black text-gray-400 uppercase mb-2">Characters so far :</h4>
                            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-medium">
                              {charPart.trim()}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <button onClick={() => setShowAIModal(false)} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                  CONTINUE READING
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className={`flex items-center justify-between p-3 border-b shadow-sm z-20 ${settings.theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSidebar(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"><Menu size={20} /></button>
          <Link to="/" className="hover:opacity-70 p-1"><ChevronLeft size={24} /></Link>
          <h2 className="font-bold truncate text-sm max-w-[120px]">{book.title}</h2>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={handleManualPageSummary} className="p-2 px-3 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-2 transition hover:scale-105 active:scale-95">
            <Wand2 size={18} />
            <span className="text-[10px] font-black uppercase hidden lg:inline">Analyze Page</span>
          </button>
          <button onClick={() => setShowAIModal(true)} className={`p-2 rounded-full transition flex items-center gap-2 px-3 ${isSummarizing ? 'animate-pulse text-yellow-500' : 'text-blue-500'}`}>
            <Sparkles size={20} />
            <span className="hidden md:inline text-xs font-black uppercase">Story</span>
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button onClick={() => setSettings(s => ({...s, theme: s.theme === 'light' ? 'dark' : 'light'}))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">{settings.theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
          <button onClick={() => setSettings(s => ({...s, flow: s.flow === 'paginated' ? 'scrolled' : 'paginated'}))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">{settings.flow === 'paginated' ? <Scroll size={20} /> : <BookOpen size={20} />}</button>
          <button onClick={() => setShowFontMenu(!showFontMenu)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><Type size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <BookView 
          bookData={book.data} settings={settings} initialLocation={book.lastLocation}
          onLocationChange={handleLocationChange} 
          onTocLoaded={setToc} tocJump={jumpTarget}
          onRenditionReady={setRendition}
          onChapterEnd={handleChapterEnd}
        />
      </div>
    </div>
  );
}