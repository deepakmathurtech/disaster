// Local AI Intent Parser for Citizen Emergency Inputs — 100% offline fallback

export type CitizenIntentType =
  | 'DISTRESS_SOS'
  | 'SUPPLY_REQUEST'
  | 'INCIDENT_REPORT'
  | 'SHELTER_INQUIRY'
  | 'CALMING_GUIDANCE'
  | 'UNKNOWN';

export interface CitizenIntentResult {
  intent: CitizenIntentType;
  confidence: number;
  extracted_params: {
    raw_text: string;
    needs?: string[];
    urgency?: 'CRITICAL' | 'HIGH' | 'MODERATE';
  };
  suggested_action?: string;
  response_text: string;
}

export function parseCitizenIntent(text: string): CitizenIntentResult {
  const lower = text.toLowerCase();

  // 1. Distress / SOS / Medical Emergency
  if (lower.match(/\b(sos|help|trapped|bleed|bleeding|injured|dying|pain|stuck|cannot move|drowning|stroke|heart attack)\b/)) {
    return {
      intent: 'DISTRESS_SOS',
      confidence: 0.98,
      extracted_params: {
        raw_text: text,
        urgency: 'CRITICAL',
      },
      suggested_action: 'SEND_SOS',
      response_text: '🚨 **Emergency SOS Trigger Recommended**\n\nI understand you need urgent emergency help. Please stay calm. Tap the red **SEND SOS SIGNAL** button to transmit your live location directly to the Emergency Command Center. Help is prioritizing your area.',
    };
  }

  // 2. Supply Requests (Food, Water, Meds, Baby food)
  if (lower.match(/\b(food|water|drink|hungry|thirsty|supplies|medicine|meds|insulin|baby food|blanket|diaper)\b/)) {
    const needs: string[] = [];
    if (lower.includes('water') || lower.includes('drink')) needs.push('Clean Water');
    if (lower.includes('food') || lower.includes('hungry')) needs.push('Rations / Food');
    if (lower.includes('medicine') || lower.includes('meds') || lower.includes('insulin')) needs.push('First Aid / Meds');
    if (lower.includes('baby') || lower.includes('diaper')) needs.push('Infant Supplies');

    return {
      intent: 'SUPPLY_REQUEST',
      confidence: 0.92,
      extracted_params: {
        raw_text: text,
        needs: needs.length > 0 ? needs : ['Essential Emergency Supplies'],
        urgency: 'HIGH',
      },
      suggested_action: 'REQUEST_SUPPLIES',
      response_text: `🍞 **Supply Request Noted**\n\nIdentified requirements: **${(needs.length > 0 ? needs : ['Essential Supplies']).join(', ')}**.\n\nYou can submit a supply request form directly to notify supply drop teams of your location.`,
    };
  }

  // 3. Shelter Inquiry / Safe Route
  if (lower.match(/\b(shelter|safe place|where to go|evacuate|route|map|refuge|hospital|camp)\b/)) {
    return {
      intent: 'SHELTER_INQUIRY',
      confidence: 0.94,
      extracted_params: {
        raw_text: text,
        urgency: 'MODERATE',
      },
      suggested_action: 'NAVIGATE_MAP',
      response_text: '🏠 **Nearby Safe Shelters Available**\n\nThe nearest verified emergency shelter is **Central High Shelter (Shelter Alpha)**. Open the **MAP** screen to calculate the **Safest Route** avoiding blocked causeways and active hazard zones.',
    };
  }

  // 4. Incident / Hazard Reporting
  if (lower.match(/\b(fire|flood|rising water|bridge collapsed|road blocked|landslide|downed wire|explosion)\b/)) {
    return {
      intent: 'INCIDENT_REPORT',
      confidence: 0.90,
      extracted_params: {
        raw_text: text,
        urgency: 'HIGH',
      },
      suggested_action: 'REPORT_INCIDENT',
      response_text: '⚠️ **Hazard Report Detected**\n\nThank you for reporting this situation. Sharing local hazards helps emergency responders steer others away from danger. Please use the **Report Situation** action on the Home screen to attach location details.',
    };
  }

  // 5. Calming / Scared / Anxiety
  if (lower.match(/\b(scared|afraid|terrified|panic|dont know what to do|help me|anxious|alone)\b/)) {
    return {
      intent: 'CALMING_GUIDANCE',
      confidence: 0.96,
      extracted_params: {
        raw_text: text,
        urgency: 'MODERATE',
      },
      response_text: '💙 **Take a slow, deep breath.** You are not alone.\n\n1. Move to higher ground if there is water, or stay inside a sturdy shelter.\n2. Keep your mobile device battery conserved.\n3. Send an **SOS Signal** if you are injured or trapped.\n4. Responders are monitoring this zone.',
    };
  }

  // Default Guidance
  return {
    intent: 'UNKNOWN',
    confidence: 0.70,
    extracted_params: { raw_text: text },
    response_text: 'ℹ️ **Emergency Assistance Guidance**\n\nI am your Citizen AI Assistant. You can ask me:\n• "Where is the nearest shelter?"\n• "I need emergency food and water."\n• "I am scared, what should I do?"\n• "How do I trigger an SOS signal?"',
  };
}
