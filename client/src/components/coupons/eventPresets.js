/**
 * Ready-made events for a quick start: each fills in the event form and creates its coupon
 * types, already designed with a matching template. Everything can be edited afterwards.
 */
const ist = (s) => new Date(`${s}+05:30`).toISOString();

export const EVENT_PRESETS = [
  {
    id: 'durga-puja',
    label: 'Durga Puja',
    bn: 'দুর্গাপূজা',
    icon: 'dhak',
    theme: 'durga',
    blurb: 'Five days · free entry passes, Ashtami & Navami bhog, cultural night',
    event: {
      title: { en: 'Durga Puja 2026', bn: 'শারদীয়া দুর্গোৎসব ২০২৬' },
      tagline: { en: 'Five days of dhak, bhog and adda', bn: '' },
      description: {
        en: 'Register once for your family and get your coupons on your phone — entry passes for everyone, bhog coupons for Ashtami and Navami, and passes for the cultural evening.\n\nShow the QR code at the entrance and at the bhog counter.',
        bn: '',
      },
      startsAt: ist('2026-10-16T07:00:00'),
      endsAt: ist('2026-10-21T22:00:00'),
      totalQuota: 500,
      maxAttendees: 10,
      linkedEventSlug: 'durga-puja-2026',
    },
    types: [
      { name: { en: 'Entry pass', bn: 'প্রবেশপত্র' }, description: { en: 'One per person — valid all five days' }, kind: 'entry', price: 0, maxPerRegistration: 10, template: 'durga-kash' },
      { name: { en: 'Ashtami bhog', bn: 'অষ্টমীর ভোগ' }, description: { en: 'Khichuri, labra, beguni, chutney & payesh' }, kind: 'food', price: 150, quota: 300, maxPerRegistration: 10, template: 'bhog-leaf' },
      { name: { en: 'Navami bhog', bn: 'নবমীর ভোগ' }, description: { en: 'Pulao, alur dom, chutney & mishti' }, kind: 'food', price: 150, quota: 300, maxPerRegistration: 10, template: 'bhog-marigold' },
      { name: { en: 'Cultural night pass', bn: 'সাংস্কৃতিক সন্ধ্যা' }, description: { en: 'Songs, dance and drama on Saptami evening' }, kind: 'other', price: 100, quota: 200, maxPerRegistration: 8, template: 'culture-stage' },
    ],
  },
  {
    id: 'bijoya',
    label: 'Bijoya Sammilani',
    bn: 'বিজয়া সম্মিলনী',
    icon: 'sindoor',
    theme: 'bijoya',
    blurb: 'An evening after Pujo · evening pass and dinner',
    event: {
      title: { en: 'Bijoya Sammilani 2026', bn: 'বিজয়া সম্মিলনী ২০২৬' },
      tagline: { en: 'Kolakuli, mishti mukh and a musical evening', bn: '' },
      description: { en: 'Greetings, music and dinner together after Pujo. Seats are limited.', bn: '' },
      totalQuota: 200,
      maxAttendees: 8,
    },
    types: [
      { name: { en: 'Evening pass', bn: 'সন্ধ্যার পাস' }, kind: 'entry', price: 200, maxPerRegistration: 8, template: 'bijoya-sindoor' },
      { name: { en: 'Dinner coupon', bn: 'নৈশভোজ' }, description: { en: 'Fish fry, mutton kosha, rice & rosogolla' }, kind: 'food', price: 350, maxPerRegistration: 8, template: 'food' },
    ],
  },
  {
    id: 'lakshmi-puja',
    label: 'Kojagori Lakshmi Puja',
    bn: 'লক্ষ্মীপূজা',
    icon: 'lamp',
    theme: 'lakshmi',
    blurb: 'Full-moon evening · free entry and khichuri bhog',
    event: {
      title: { en: 'Kojagori Lakshmi Puja 2026', bn: 'কোজাগরী লক্ষ্মীপূজা ২০২৬' },
      tagline: { en: 'An evening of prayer under the full moon', bn: '' },
      description: { en: 'Join us for Lakshmi Puja, followed by bhog.', bn: '' },
      totalQuota: 250,
      maxAttendees: 10,
    },
    types: [
      { name: { en: 'Entry pass', bn: 'প্রবেশপত্র' }, kind: 'entry', price: 0, maxPerRegistration: 10, template: 'lakshmi-moon' },
      { name: { en: 'Bhog', bn: 'ভোগ' }, description: { en: 'Khichuri, labra & payesh' }, kind: 'food', price: 100, maxPerRegistration: 10, template: 'bhog-leaf' },
    ],
  },
  {
    id: 'kali-puja',
    label: 'Kali Puja & Diwali',
    bn: 'কালীপূজা',
    icon: 'lamp',
    theme: 'lakshmi',
    blurb: 'Night of lights · entry and bhog',
    event: {
      title: { en: 'Kali Puja & Diwali 2026', bn: 'কালীপূজা ও দীপাবলি ২০২৬' },
      tagline: { en: 'A night of diyas, prayer and celebration', bn: '' },
      description: { en: 'Light a diya with us — puja, bhog and the festival of lights.', bn: '' },
      totalQuota: 300,
      maxAttendees: 10,
    },
    types: [
      { name: { en: 'Entry pass', bn: 'প্রবেশপত্র' }, kind: 'entry', price: 0, maxPerRegistration: 10, template: 'diya-glow' },
      { name: { en: 'Bhog', bn: 'ভোগ' }, kind: 'food', price: 120, maxPerRegistration: 10, template: 'bhog-marigold' },
    ],
  },
  {
    id: 'saraswati-puja',
    label: 'Saraswati Puja',
    bn: 'সরস্বতী পূজা',
    icon: 'book',
    theme: 'saraswati',
    blurb: 'Basanta Panchami · free entry, anjali and khichuri',
    event: {
      title: { en: 'Saraswati Puja 2027', bn: 'সরস্বতী পূজা ২০২৭' },
      tagline: { en: 'Anjali, hate khori and khichuri bhog', bn: '' },
      description: { en: 'Bring the little ones for hate khori, offer anjali and stay for bhog.', bn: '' },
      totalQuota: 250,
      maxAttendees: 10,
    },
    types: [
      { name: { en: 'Entry pass', bn: 'প্রবেশপত্র' }, kind: 'entry', price: 0, maxPerRegistration: 10, template: 'saraswati-basanti' },
      { name: { en: 'Khichuri bhog', bn: 'খিচুড়ি ভোগ' }, kind: 'food', price: 100, maxPerRegistration: 10, template: 'bhog-leaf' },
    ],
  },
  {
    id: 'poila-boishakh',
    label: 'Poila Boishakh',
    bn: 'নববর্ষ',
    icon: 'alpana',
    theme: 'boishakh',
    blurb: 'Bengali New Year · entry and a festive lunch',
    event: {
      title: { en: 'Poila Boishakh 1434', bn: 'শুভ নববর্ষ ১৪৩৪' },
      tagline: { en: 'Welcome the Bengali New Year with songs and a feast', bn: '' },
      description: { en: 'Prabhat pheri, songs, and a traditional Bengali lunch.', bn: '' },
      totalQuota: 200,
      maxAttendees: 8,
    },
    types: [
      { name: { en: 'Entry pass', bn: 'প্রবেশপত্র' }, kind: 'entry', price: 0, maxPerRegistration: 8, template: 'boishakh-toran' },
      { name: { en: 'New Year lunch', bn: 'নববর্ষের ভোজ' }, kind: 'food', price: 300, maxPerRegistration: 8, template: 'bhog-marigold' },
    ],
  },
  {
    id: 'cultural-evening',
    label: 'Cultural evening / concert',
    bn: 'সাংস্কৃতিক সন্ধ্যা',
    icon: 'music',
    theme: 'culture',
    blurb: 'Audience passes, VIP front row and snacks',
    event: {
      title: { en: 'Parbon Cultural Evening', bn: 'পার্বণ সাংস্কৃতিক সন্ধ্যা' },
      tagline: { en: 'Music, dance and drama by our community', bn: '' },
      description: { en: 'An evening of performances by members of the community.', bn: '' },
      totalQuota: 300,
      maxAttendees: 6,
    },
    types: [
      { name: { en: 'Audience pass', bn: 'দর্শক পাস' }, kind: 'entry', price: 100, maxPerRegistration: 6, template: 'culture-poster' },
      { name: { en: 'VIP front row', bn: 'বিশেষ আসন' }, kind: 'entry', price: 500, quota: 30, maxPerRegistration: 4, template: 'vip-gold' },
      { name: { en: 'Snacks coupon', bn: 'জলখাবার' }, kind: 'food', price: 80, maxPerRegistration: 6, template: 'food' },
    ],
  },
  {
    id: 'meetup',
    label: 'Meet-up / adda',
    bn: 'আড্ডা',
    icon: 'people',
    theme: 'general',
    blurb: 'A simple get-together · free entry and snacks',
    event: {
      title: { en: 'Parbon Meet & Greet', bn: 'চা, শিঙাড়া আর আড্ডা' },
      tagline: { en: 'Cha, shingara, mishti & adda', bn: '' },
      description: { en: 'An informal get-together for everyone who would like to be part of Parbon.', bn: '' },
      totalQuota: 100,
      maxAttendees: 6,
    },
    types: [
      { name: { en: 'Entry', bn: 'প্রবেশ' }, kind: 'entry', price: 0, maxPerRegistration: 6, template: 'minimal' },
      { name: { en: 'Cha & snacks', bn: 'চা-জলখাবার' }, kind: 'food', price: 0, maxPerRegistration: 6, template: 'food' },
    ],
  },
];
