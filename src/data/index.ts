/**
 * Fotoce data layer — barrel export.
 *
 *  Branchement standard côté `main.ts` :
 *
 *    import { VueQueryPlugin } from '@tanstack/vue-query'
 *    import { queryClient, installQueryPersister } from './data'
 *    app.use(VueQueryPlugin, { queryClient })
 *    installQueryPersister()
 *
 *  Usage côté composant :
 *
 *    import { useQuery } from '@tanstack/vue-query'
 *    import { qk } from '@/data'
 *    const { data } = useQuery({ queryKey: qk.feed.home(), queryFn: ... })
 */

export * from './queryClient'
export * from './queryPersister'
export * from './queryKeys'
