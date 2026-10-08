import { requireAuthUser } from '../../../utils/supabase'
import { checkEnrolledReaderAccess, UUID_REGEX } from '../../../utils/enrolledReader'

export default defineEventHandler(async (event) => {
  const { client, user } = await requireAuthUser(event)

  const articleId = getRouterParam(event, 'id')
  if (!articleId || !UUID_REGEX.test(articleId)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  // 1. Query article by id
  const { data: article, error: artError } = await client
    .from('articles')
    .select('id, offering_id, title, body, status, published_at, version')
    .eq('id', articleId)
    .single()

  // Prohibit reading non-existent rows or non-published articles (drafts must never leak)
  if (artError || !article || article.status !== 'published') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  // 2. Verify caller has reader entitlement for the article's offering
  const access = await checkEnrolledReaderAccess(client, user.id, article.offering_id)
  if (!access.allowed) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found',
    })
  }

  // Return minimal reader DTO (no author email, no student identities, no sensitive metadata)
  return {
    article: {
      id: article.id,
      offering_id: article.offering_id,
      title: article.title,
      body: article.body,
      published_at: article.published_at,
      version: article.version,
    },
  }
})
