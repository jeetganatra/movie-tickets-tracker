import type { CityInfo } from "@/types";

export const CITIES: CityInfo[] = [
  { name: "Mumbai", bmsCode: "MUMBAI", bmsSlug: "mumbai", districtSlug: "mumbai" },
  { name: "Delhi-NCR", bmsCode: "NCR", bmsSlug: "ncr", districtSlug: "delhi-ncr" },
  { name: "Bengaluru", bmsCode: "BANG", bmsSlug: "bengaluru", districtSlug: "bengaluru" },
  { name: "Hyderabad", bmsCode: "HYD", bmsSlug: "hyderabad", districtSlug: "hyderabad" },
  { name: "Chennai", bmsCode: "CHEN", bmsSlug: "chennai", districtSlug: "chennai" },
  { name: "Kolkata", bmsCode: "KOLK", bmsSlug: "kolkata", districtSlug: "kolkata" },
  { name: "Pune", bmsCode: "PUNE", bmsSlug: "pune", districtSlug: "pune" },
  { name: "Ahmedabad", bmsCode: "AMD", bmsSlug: "ahmedabad", districtSlug: "ahmedabad" },
  { name: "Jaipur", bmsCode: "JAIPUR", bmsSlug: "jaipur", districtSlug: "jaipur" },
  { name: "Lucknow", bmsCode: "LUCK", bmsSlug: "lucknow", districtSlug: "lucknow" },
  { name: "Chandigarh", bmsCode: "CHD", bmsSlug: "chandigarh", districtSlug: "chandigarh" },
  { name: "Kochi", bmsCode: "KOCH", bmsSlug: "kochi", districtSlug: "kochi" },
  { name: "Goa", bmsCode: "GOA", bmsSlug: "goa", districtSlug: "goa" },
  { name: "Indore", bmsCode: "INDR", bmsSlug: "indore", districtSlug: "indore" },
];

export function getCityByName(name: string): CityInfo | undefined {
  return CITIES.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}
