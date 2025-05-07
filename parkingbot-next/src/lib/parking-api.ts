import { updateParkingSpaces } from '../db/utils';

export interface ParkingData {
  id: string;
  name: string;
  street: string;
  house: string;
  subway: string;
  totalSpaces: number;
  freeSpaces: number;
  handicappedTotal: number;
  handicappedFree: number;
  parkingNumber: string;
}

export const PARKING_AREAS = {
  'САО': ['27069', '37437', '31811', '41965', '26674'],
  'СВАО': ['29794', '37709', '25285', '28497', '41961'],
  'ВАО': ['37434', '28490', '28492', '28491', '25335', '31814', '25307', '40094', '40095', '25322', '25332', '25330'],
  'ЮВАО': ['41969', '31809', '27166', '28498', '25313', '37435', '25281', '25309'],
  'ЮАО': ['25253', '27167', '41966', '41968', '41967', '26741', '29945', '37436', '25314', '25320', 
        '26744', '25287', '25257', '25273', '29924', '25270', '26740', '25323', '25278', '25279', 
        '25276', '25277', '25311', '27986'],
  'ЮЗАО': ['25334', '31903', '31816', '25333', '25252', '28634', '28505', '27164', '25286', '25290', 
         '25280', '25282', '25261', '25274'],
  'ЗАО': ['27127', '41911', '41963', '27168', '27169', '28485', '31810', '28488', '27136', '26683'],
  'СЗАО': ['27173', '26675', '25275', '35257', '28546', '25255', '41962', '26742'],
  'НАО': ['28486', '28487', '25316', '25315', '26931', '26932', '26933']
};

export async function getParkingInfo(parkingId: string): Promise<ParkingData | null> {
  const url = `https://lk.parking.mos.ru/api/3.0/parkings/${parkingId}`;
  
  try {
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // Revalidate every 5 minutes
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    const parkingData = data.parking;
    if (!parkingData) {
      throw new Error('No parking data in response');
    }
    
    const name = parkingData.name?.ru || '';
    const address = parkingData.address || {};
    const street = address.street?.ru || '';
    const house = address.house?.ru || '';
    const subway = parkingData.subway?.ru || '';
    
    const congestion = parkingData.congestion || {};
    const spaces = congestion.spaces || {};
    const overall = spaces.overall || {};
    const totalSpaces = overall.total || 0;
    const freeSpaces = overall.free || 0;
    
    const handicapped = spaces.handicapped || {};
    const handicappedTotal = handicapped.total || 0;
    const handicappedFree = handicapped.free || 0;
    
    const zone = parkingData.zone || {};
    const parkingNumber = zone.number || '';
    
    // Update the database with the latest data
    await updateParkingSpaces(
      parkingId, 
      freeSpaces, 
      totalSpaces, 
      handicappedFree, 
      handicappedTotal
    );
    
    return {
      id: parkingId,
      name,
      street,
      house,
      subway,
      totalSpaces,
      freeSpaces,
      handicappedTotal,
      handicappedFree,
      parkingNumber
    };
    
  } catch (error) {
    console.error(`Error fetching parking info for ID ${parkingId}:`, error);
    return null;
  }
}

export async function fetchAllParkings(): Promise<ParkingData[]> {
  const parkings: ParkingData[] = [];
  
  for (const area in PARKING_AREAS) {
    const parkingIds = PARKING_AREAS[area as keyof typeof PARKING_AREAS];
    
    for (const id of parkingIds) {
      const parkingInfo = await getParkingInfo(id);
      if (parkingInfo) {
        parkings.push(parkingInfo);
      }
    }
  }
  
  return parkings;
}

export function getYandexMapsUrl(parking: ParkingData): string {
  const address = `${parking.street} ${parking.house}`;
  const encodedAddress = encodeURIComponent(address);
  return `yandexmaps://maps.yandex.ru/?text=${encodedAddress}`;
} 