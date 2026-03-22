export interface ShowInfo {
  theaterName: string;
  showtime: string;
  format: string;
  language: string;
  availabilityStatus: string;
  price?: string;
  bookingUrl?: string;
}

export interface ShowtimeResult {
  platform: "bookmyshow" | "district";
  found: boolean;
  shows: ShowInfo[];
  error?: string;
}
