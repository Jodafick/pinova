export type Pin = {
  id: number
  title: string
  description: string
  imageUrl: string
  user: string
  userAvatarColor: string
  link: string
  stats: {
    saves: number
    reactions: number
  }
  topic: string
  tall?: boolean
  saved?: boolean
  boardId?: number
  createdAt: string
}

export type Board = {
  id: number
  name: string
  description: string
  coverUrl: string
  pinCount: number
  isPrivate: boolean
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
  boards: Board[]
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
