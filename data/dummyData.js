export const DUMMY_DATA = {
  parties: [
    { id: "party_001", name: "Dhanlobhe Traders", location: "Kolhapur" },
    { id: "party_002", name: "ABC Trading", location: "Sangli" },
    { id: "party_003", name: "XYZ Traders", location: "Pune" },
    { id: "party_004", name: "Patil Brothers", location: "Satara" }
  ],
  products: [
    { id: "rice", name: "Rice", localName: "तांदूळ" },
    { id: "maize", name: "Maize", localName: "मका" },
    { id: "ragi", name: "Finger Millet / Ragi", localName: "नाचणी" },
    { id: "groundnut", name: "Groundnut", localName: "भुईमूग" },
    { id: "sunflower", name: "Sunflower", localName: "सूर्यफूल" }
  ],
  varieties: {
    "rice": [
      { id: "rice_variety_a", name: "Variety A" },
      { id: "rice_variety_b", name: "Variety B" },
      { id: "rice_variety_c", name: "Variety C" },
      { id: "rice_variety_d", name: "Variety D" }
    ],
    "maize": [
      { id: "maize_variety_a", name: "Variety A" },
      { id: "maize_variety_b", name: "Variety B" },
      { id: "maize_variety_c", name: "Variety C" }
    ],
    "ragi": [
      { id: "ragi_variety_a", name: "Local Ragi" },
      { id: "ragi_variety_b", name: "Hybrid Ragi" }
    ],
    "groundnut": [
      { id: "gn_variety_a", name: "Ghungroo" },
      { id: "gn_variety_b", name: "Java" }
    ],
    "sunflower": [
      { id: "sf_variety_a", name: "Black Seed" },
      { id: "sf_variety_b", name: "Striped Seed" }
    ]
  },
  transactions: [
    {
      id: 't1',
      partyId: '1',
      date: '2023-10-25',
      totalBags: 15,
      totalWeight: 750.5,
      items: [
        {
          productId: 'p1',
          varietyId: 'v1',
          weights: [50.5, 50.0, 50.1, 49.9, 50.0]
        }
      ]
    }
  ]
};
