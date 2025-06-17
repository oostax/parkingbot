"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl";
import { ParkingInfo } from "@/types/parking";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapComponentProps {
  parkings: ParkingInfo[];
  selectedParking: ParkingInfo | null;
  onParkingSelect: (parking: ParkingInfo) => void;
}

export default function MapComponent({ parkings, selectedParking, onParkingSelect }: MapComponentProps) {
  const [viewState, setViewState] = useState({
    longitude: 37.6156, // Moscow center
    latitude: 55.7522, // Moscow center
    zoom: 10,
  });
  
  const mapRef = useRef<any>(null);

  // Fly to selected parking
  const flyToParking = useCallback(
    (parking: ParkingInfo) => {
      if (mapRef.current) {
        const longitude = parking.lng || parking.lon || 37.6156;
        mapRef.current.flyTo({
          center: [longitude, parking.lat],
          zoom: 14,
          duration: 1000,
          essential: true,
        });
      }
    },
    []
  );

  // Update map when selected parking changes
  useEffect(() => {
    if (selectedParking) {
      flyToParking(selectedParking);
    }
  }, [selectedParking, flyToParking]);

  // Listen for custom parking-selected events
  useEffect(() => {
    const handleCustomParkingSelected = (event: any) => {
      const parking = event.detail?.parking;
      if (parking) {
        onParkingSelect(parking);
      }
    };

    // Add event listener
    document.addEventListener('parking-selected', handleCustomParkingSelected);

    // Clean up the event listener
    return () => {
      document.removeEventListener('parking-selected', handleCustomParkingSelected);
    };
  }, [onParkingSelect]);

  return (
    <Map
      {...viewState}
      ref={mapRef}
      mapboxAccessToken="pk.eyJ1IjoiYXJ0ZW1ib3Jkb3ZpY2giLCJhIjoiY2xxM2Jhdm5wMGIzdzJqbm90YjNzZDZnNCJ9.WOgj_4UKYHawxL6ECd657Q"
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      onMove={(evt) => setViewState(evt.viewState)}
      attributionControl={false}
    >
      <NavigationControl position="top-right" />

      {parkings.map((parking) => (
        <Marker
          key={parking.id}
          longitude={parking.lng || parking.lon || 37.6156} // Default to Moscow center longitude if nothing available
          latitude={parking.lat}
          anchor="bottom"
          onClick={(e) => {
            // Prevent click from propagating to the map
            e.originalEvent.stopPropagation();
            onParkingSelect(parking);
          }}
        >
          <div
            className={`cursor-pointer transition-all ${
              selectedParking?.id === parking.id
                ? "scale-125"
                : "hover:scale-110"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                parking.isFavorite ? "bg-amber-500" : "bg-blue-500"
              }`}
            >
              <span className="text-white text-xs">{parking.freeSpaces !== undefined ? parking.freeSpaces : "?"}</span>
            </div>
            <div
              className={`w-0 h-0 border-left-[6px] border-right-[6px] border-t-[8px] mx-auto -mt-[1px] ${
                parking.isFavorite ? "border-t-amber-500" : "border-t-blue-500"
              } border-l-transparent border-r-transparent`}
            ></div>
          </div>
        </Marker>
      ))}
    </Map>
  );
}