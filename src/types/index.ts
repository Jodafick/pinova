export type Pin = {
  id: number
  slug: string
  title: string
  description: string
  imageUrl: string
  user: string
  username: string
  userId: number
  userAvatarUrl?: string
  userAvatarColor: string
  link: string
  stats: {
    saves: number
    reactions: number
  }
  topic: string
  tall?: boolean
  saved?: boolean
  liked?: boolean
  isFollowing?: boolean
  createdAt: string
}

export type User = {
  id: number
  username: string
  displayName: string
  email: string
  avatarUrl?: string
  avatarColor: string
  bio: string
  followers: number
  following: number
  isFollowing?: boolean
  savedPins: number[]
}

export type Notification = {
  id: number
  type: 'like' | 'save' | 'follow' | 'comment'
  message: string
  fromUser: string
  avatarColor: string
  read: boolean
  createdAt: string
}
