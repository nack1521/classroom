import { requireAuthUser } from '../../utils/supabase'
import { checkEnrolledReaderAccess } from '../../utils/enrolledReader'

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  const query = getQuery(event)
  const offeringId = typeof query.offering_id === 'string' ? query.offering_id.trim() : ''

  if (!offeringId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Offering not found or access denied',
    })
  }

  // Verify caller is an active enrolled student or assigned teacher for this offering
  const access = await checkEnrolledReaderAccess(client, user.id, offeringId)
  if (!access.allowed) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Offering not found or access denied',
    })
  }

  // Query only published articles in this offering
  const { data, error } = await client
    .from('articles')
    .select('id, offering_id, title, published_at, version')
    .eq('offering_id', offeringId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to retrieve published articles',
    })
  }

  // Explicit DTO projection guarantees no body or author fields leak
  return {
    articles: (data || []).map((art: any) => ({
      id: art.id,
      offering_id: art.offering_id,
      title: art.title,
      published_at: art.published_at,
      version: art.version,
    })),
  }
})
