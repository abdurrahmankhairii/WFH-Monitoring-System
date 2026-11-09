// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import axios from 'axios';
import { Logger } from '@nestjs/common';

const logger = new Logger('ReverseGeocodingUtil');

// Feature: Geolocation Tagging & Reverse Geocoding — Purpose: Resolves GPS coordinates into street-level address using OpenStreetMap Nominatim with BigDataCloud fallback.
// OOP: Stateless Utility Module (External Integration Adapter) — Connected To: Called by AttendanceService and EmployeesService during Clock-In, Clock-Out, and Home Registration.
export async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<string> {
  const coordFallback = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

  // Primary Provider: OpenStreetMap Nominatim (100% Free, ODbL License)
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'json',
        lat,
        lon,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'Dexa-WFH-Monitoring-System/1.0 (admin.hrd@dexagroup.com)',
        Accept: 'application/json',
      },
      timeout: 3800,
    });

    if (res.data && res.data.display_name) {
      const addr = res.data.address;
      if (addr) {
        const parts = [
          addr.road || addr.pedestrian || addr.suburb,
          addr.city_district || addr.suburb || addr.village,
          addr.city || addr.town || addr.county,
          addr.state || addr.province,
          addr.country,
        ].filter(Boolean);
        if (parts.length >= 2) {
          return parts.join(', ');
        }
      }
      return String(res.data.display_name);
    }
  } catch (err) {
    logger.warn(`Nominatim geocoding failed or timed out: ${(err as Error).message}. Attempting BigDataCloud fallback...`);
  }

  // Secondary Provider: BigDataCloud Free Reverse Geocode (100% Free, No API Key Required)
  try {
    const fallbackRes = await axios.get('https://api.bigdatacloud.net/data/reverse-geocode-client', {
      params: {
        latitude: lat,
        longitude: lon,
        localityLanguage: 'id',
      },
      timeout: 3500,
    });

    if (fallbackRes.data) {
      const data = fallbackRes.data;
      const parts = [
        data.locality,
        data.city,
        data.principalSubdivision,
        data.countryName,
      ].filter(Boolean);

      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (fallbackErr) {
    logger.warn(`BigDataCloud fallback geocoding failed: ${(fallbackErr as Error).message}`);
  }

  return coordFallback;
}
