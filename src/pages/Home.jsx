import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { addBook, getAllBooks, deleteBook, toggleFavorite } from '../services/db'; 
import { Plus, Book as BookIcon, User, Calendar, Trash2, Clock, Search, Heart, Filter } from 'lucide-react';

export default function Home() {
  const [books, setBooks] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "favorites", "finished"

  useEffect(() => { loadLibrary(); }, []);

  const loadLibrary = async () => {
    const storedBooks = await getAllBooks();
    setBooks(storedBooks);
  };

  const handleDeleteBook = async (e, id) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    if (window.confirm("Are you sure you want to delete this book?")) {
      await deleteBook(id);
      loadLibrary(); 
    }
  };

  const handleToggleFavorite = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavorite(id);
    loadLibrary();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/epub+zip") {
      setIsUploading(true);
      await addBook(file);
      await loadLibrary();
      setIsUploading(false);
    }
  };

  // --- Search & Filter Logic ---
  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      activeFilter === "all" ? true :
      activeFilter === "favorites" ? book.isFavorite :
      activeFilter === "finished" ? book.progress >= 100 : true;

    return matchesSearch && matchesFilter;
  });

  const formatTime = (totalSeconds) => {
    if (!totalSeconds || totalSeconds < 60) return "Just started";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatLastRead = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return "Read today";
    if (diffInDays === 1) return "Read yesterday";
    if (diffInDays < 7) return `Read ${diffInDays} days ago`;
    return `Read ${date.toLocaleDateString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 text-gray-900 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">My Library</h1>
            <p className="text-gray-500 mt-1">
              {filteredBooks.length === books.length 
                ? `You have ${books.length} books` 
                : `Showing ${filteredBooks.length} of ${books.length} books`}
            </p>
          </div>

          <label className={`cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Plus size={20} />
            <span>{isUploading ? 'Adding...' : 'Add Book'}</span>
            <input type="file" accept=".epub" className="hidden" onChange={handleFileUpload} />
          </label>
        </header>

        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Search by title or author..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex bg-white p-1 border border-gray-200 rounded-2xl shadow-sm">
            {['all', 'favorites', 'finished'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                  activeFilter === filter 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {filteredBooks.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center shadow-sm">
            <BookIcon size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No books found matching your criteria.</p>
            {searchQuery && (
              <button 
                onClick={() => {setSearchQuery(""); setActiveFilter("all");}}
                className="mt-4 text-blue-600 font-bold hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-in fade-in duration-500">
            {filteredBooks.map((book) => (
              <Link 
                to={`/read?id=${book.id}`} 
                key={book.id}
                className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col relative"
              >
                <div className="aspect-[3/4] bg-gray-200 overflow-hidden relative">
                  {book.cover ? (
                    <img src={book.cover} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                      <BookIcon size={40} className="mb-2 opacity-20" />
                      <span className="text-xs font-medium uppercase tracking-widest">{book.title}</span>
                    </div>
                  )}

                  {/* Top Actions Overlay */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      onClick={(e) => handleDeleteBook(e, book.id)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md transition-transform active:scale-95"
                      title="Delete Book"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => handleToggleFavorite(e, book.id)}
                      className={`p-2 rounded-xl shadow-md transition-all active:scale-95 ${
                        book.isFavorite ? 'bg-pink-500 text-white' : 'bg-white text-gray-400 hover:text-pink-500'
                      }`}
                      title="Favorite"
                    >
                      <Heart size={16} fill={book.isFavorite ? "currentColor" : "none"} />
                    </button>
                  </div>
                  
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-lg">
                    {book.progress}%
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {book.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <User size={14} />
                    <span className="truncate">{book.author}</span>
                  </div>

                  <div className="flex items-center gap-2 text-blue-500 text-xs mt-2 font-semibold">
                    <Clock size={12} />
                    <span>{formatTime(book.readingTime)}</span>
                  </div>

                  <div className="mt-auto pt-4 flex justify-between items-center text-[10px] text-gray-400 font-medium">
                    {book.pubDate ? (
                      <div className="flex items-center gap-1">
                        <Calendar size={10} />
                        <span>{new Date(book.pubDate).getFullYear() || book.pubDate}</span>
                      </div>
                    ) : <span></span>}
                    
                    <span>{formatLastRead(book.lastRead)}</span>
                  </div>

                  <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-1000" 
                      style={{ width: `${book.progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}