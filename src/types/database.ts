export type Trip = {
  id: string
  title: string
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export type TripDay = {
  id: string
  trip_id: string
  day_date: string
  memo: string | null
  created_at: string
  updated_at: string
}

export type TripEvent = {
  id: string
  trip_day_id: string
  title: string
  location: string | null
  start_time: string | null
  end_time: string | null
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}
