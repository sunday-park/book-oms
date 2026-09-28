'use server'

import { getDb } from '@/lib/db'
import * as repo from '@/lib/repo/master'
import { wrap } from '@/lib/result'

export async function listPublishers() {
  return wrap(() => repo.listPublishers(getDb()))
}
export async function savePublisher(input: repo.PublisherInput, id?: number) {
  return wrap(() => repo.savePublisher(getDb(), input, id))
}
export async function deletePublisher(id: number) {
  return wrap(() => repo.deletePublisher(getDb(), id))
}

export async function listBookstores() {
  return wrap(() => repo.listBookstores(getDb()))
}
export async function saveBookstore(input: repo.BookstoreInput, id?: number) {
  return wrap(() => repo.saveBookstore(getDb(), input, id))
}
export async function deleteBookstore(id: number) {
  return wrap(() => repo.deleteBookstore(getDb(), id))
}

export async function listBooks(publisherId?: number) {
  return wrap(() => repo.listBooks(getDb(), publisherId))
}
export async function createBook(input: repo.BookInput) {
  return wrap(() => repo.createBook(getDb(), input))
}
export async function updateBook(id: number, input: { name: string; list_price: number }) {
  return wrap(() => repo.updateBook(getDb(), id, input))
}
export async function deleteBook(id: number) {
  return wrap(() => repo.deleteBook(getDb(), id))
}
