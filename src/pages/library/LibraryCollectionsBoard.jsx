import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  FolderClosed,
  Check,
  Pencil,
  Trash2,
  X,
  Book as BookIcon,
  Search,
  User
} from "lucide-react";

export default function LibraryCollectionsBoard({
  collections,
  books,
  collectionError,
  showCreateCollectionForm,
  collectionNameDraft,
  collectionColorDraft,
  collectionColorOptions,
  editingCollectionId,
  editingCollectionName,
  onToggleCreateForm,
  onCollectionNameChange,
  onCollectionColorChange,
  onCreateCollection,
  onCollectionRenameStart,
  onCollectionRenameInputChange,
  onCollectionRenameSave,
  onCollectionRenameCancel,
  onCollectionDelete,
  onOpenBook,
  onRemoveFromCollection,
  buildReaderPath
}) {
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id || "");
  const [collectionSearch, setCollectionSearch] = useState("");

  const activeBooks = useMemo(
    () => books.filter((book) => !book.isDeleted),
    [books]
  );

  const booksByCollection = useMemo(() => {
    return collections.reduce((acc, collection) => {
      acc[collection.id] = activeBooks
        .filter((book) => Array.isArray(book.collectionIds) && book.collectionIds.includes(collection.id))
        .sort((left, right) => new Date(right.lastRead || 0).getTime() - new Date(left.lastRead || 0).getTime());
      return acc;
    }, {});
  }, [collections, activeBooks]);

  const filteredCollections = useMemo(() => {
    const query = collectionSearch.trim().toLowerCase();
    if (!query) return collections;
    return collections.filter((collection) => (collection.name || "").toLowerCase().includes(query));
  }, [collections, collectionSearch]);

  useEffect(() => {
    if (!collections.length) {
      setSelectedCollectionId("");
      return;
    }
    if (!collections.some((collection) => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    if (!filteredCollections.length) return;
    if (!filteredCollections.some((collection) => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(filteredCollections[0].id);
    }
  }, [filteredCollections, selectedCollectionId]);

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) || null;
  const selectedCollectionBooks = selectedCollection ? (booksByCollection[selectedCollection.id] || []) : [];

  return (
    <section data-testid="collections-board" className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Collections directory</h2>
          <p className="mt-1 text-xs text-gray-500">
            Browse collections on the left and manage books in the selected collection on the right.
          </p>
        </div>
        <button
          type="button"
          data-testid="collection-add-toggle"
          onClick={onToggleCreateForm}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100"
        >
          <Plus size={16} />
          <span>{showCreateCollectionForm ? "Close" : "Add collection"}</span>
        </button>
      </div>

      {showCreateCollectionForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-700">Create a collection</div>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
            <input
              data-testid="collection-create-input"
              value={collectionNameDraft}
              onChange={(e) => onCollectionNameChange(e.target.value)}
              placeholder="Collection name (e.g. Classics)"
              className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              {collectionColorOptions.map((color) => (
                <button
                  key={`draft-${color}`}
                  type="button"
                  data-testid="collection-color-option"
                  onClick={() => onCollectionColorChange(color)}
                  className={`h-6 w-6 rounded-full border-2 ${collectionColorDraft === color ? "border-gray-900" : "border-white"}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <button
              type="button"
              data-testid="collection-create-button"
              onClick={onCreateCollection}
              className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
            >
              Create
            </button>
          </div>
          {collectionError && (
            <div className="mt-2 text-xs font-semibold text-red-600">{collectionError}</div>
          )}
        </div>
      )}

      {collections.length === 0 ? (
        <div
          data-testid="collections-empty"
          className="rounded-3xl border-2 border-dashed border-gray-200 bg-white p-14 text-center shadow-sm"
        >
          <FolderClosed size={44} className="mx-auto mb-3 text-gray-300" />
          <div className="text-lg font-semibold text-gray-900">No collections yet</div>
          <div className="mt-1 text-sm text-gray-500">Create your first shelf to organize your reading board.</div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]" data-testid="collections-directory-layout">
          <aside className="flex h-[72vh] min-h-[560px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-sm" data-testid="collections-directory-panel">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                data-testid="collections-search"
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
                placeholder="Search collections..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredCollections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                  No collections match your search.
                </div>
              ) : (
                filteredCollections.map((collection) => {
                  const items = booksByCollection[collection.id] || [];
                  const isSelected = collection.id === selectedCollectionId;
                  const isEditing = editingCollectionId === collection.id;

                  return (
                    <article
                      key={collection.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        isSelected ? "border-blue-200 bg-blue-50/60" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEditing) setSelectedCollectionId(collection.id);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          {isEditing ? (
                            <input
                              data-testid="collection-rename-input"
                              value={editingCollectionName}
                              onChange={(e) => onCollectionRenameInputChange(e.target.value)}
                              className="h-8 w-full rounded-lg border border-gray-200 px-2 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: collection.color }}
                                />
                                <h3 data-testid="collection-item-name" className="truncate text-sm font-bold text-gray-900">
                                  {collection.name}
                                </h3>
                              </div>
                              <p className="mt-1 text-xs text-gray-500">
                                {items.length} book{items.length === 1 ? "" : "s"}
                              </p>
                            </>
                          )}
                        </button>

                        <div className="ml-2 flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                data-testid="collection-rename-save"
                                onClick={onCollectionRenameSave}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-bold text-emerald-700"
                              >
                                <Check size={12} />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={onCollectionRenameCancel}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-600"
                              >
                                <X size={12} />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                data-testid="collection-rename-button"
                                onClick={() => onCollectionRenameStart(collection)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 hover:border-blue-200 hover:text-blue-700"
                                title="Rename collection"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                data-testid="collection-delete-button"
                                onClick={() => onCollectionDelete(collection.id)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-bold text-red-600 hover:bg-red-100"
                                title="Delete collection"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex h-[72vh] min-h-[560px] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" data-testid="collections-detail-panel">
            {!selectedCollection ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 text-sm text-gray-500">
                Select a collection to view its books.
              </div>
            ) : (
              <>
                <header className="mb-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: selectedCollection.color }}
                    />
                    <h3 className="text-base font-bold text-gray-900">{selectedCollection.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedCollectionBooks.length} book{selectedCollectionBooks.length === 1 ? "" : "s"} in this collection
                  </p>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {selectedCollectionBooks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                      No books in this collection yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedCollectionBooks.map((book) => (
                        <article
                          key={`${selectedCollection.id}-${book.id}`}
                          data-testid="collection-column-book"
                          className="group rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
                        >
                          <div className="flex gap-2">
                            <Link
                              to={buildReaderPath(book.id)}
                              onClick={() => onOpenBook(book.id)}
                              className="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-gray-100 bg-gray-100"
                            >
                              {book.cover ? (
                                <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-gray-300">
                                  <BookIcon size={14} />
                                </div>
                              )}
                            </Link>

                            <div className="min-w-0 flex-1">
                              <Link
                                to={buildReaderPath(book.id)}
                                onClick={() => onOpenBook(book.id)}
                                className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-blue-700"
                              >
                                {book.title}
                              </Link>
                              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                <User size={11} />
                                <span className="truncate">{book.author}</span>
                              </div>
                              <div className="mt-1 text-xs font-semibold text-blue-600">{book.progress || 0}%</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            data-testid="collection-book-remove"
                            onClick={() => onRemoveFromCollection(book.id, selectedCollection.id)}
                            className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
