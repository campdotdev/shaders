import { NextResponse } from 'next/server'
import { getDocsSearchDocuments } from '@/content/search'

export const dynamic = 'force-static'

export async function GET() {
  const docs = await getDocsSearchDocuments()
  return NextResponse.json(docs)
}
