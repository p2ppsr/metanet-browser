// components/BookmarkStore.tsx

import { makeAutoObservable } from 'mobx'

export type Bookmark = {
  id: string
  title: string
  url: string
}

class BookmarkStore {
  bookmarks: Bookmark[] = []

  constructor() {
    makeAutoObservable(this)
  }

  addBookmark = (bookmark: Bookmark) => {
    this.bookmarks.push(bookmark)
  }

  removeBookmark = (id: string) => {
    this.bookmarks = this.bookmarks.filter(b => b.id !== id)
  }

  setBookmarks = (bookmarks: Bookmark[]) => {
    this.bookmarks = bookmarks
  }

  get count() {
    return this.bookmarks.length
  }
}

const bookmarkStore = new BookmarkStore()
export default bookmarkStore
