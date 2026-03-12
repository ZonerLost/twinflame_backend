const GENDER = {
  MALE: "male",
  FEMALE: "female",
};

const MARITAL_STATUS = {
  SINGLE: "single",
  MARRIED: "married",
  SEPARATED: "separated",
  NOT_DISCLOSED: "not_disclosed",
};

const LOOKING_FOR = {
  MALES_FOR_MALES: "males_for_males",
  MALES_FOR_FEMALES: "males_for_females",
  FEMALES_FOR_FEMALES: "females_for_females",
  FEMALES_FOR_MALES: "females_for_males",
  GROUP_SOCIALS: "group_socials",
};

const SWIPE_ACTION = {
  LIKE: "like",
  NOPE: "nope",
  SUPERLIKE: "superlike",
};

const BELIEF_VALUES = {
  YES: "yes",
  NO: "no",
  NOT_SURE: "not_sure",
};

const LIFESTYLE_OPTIONS = [
  "smoker_occasional",
  "social_drinker",
  "regular_drinker",
  "cannabis_friendly",
  "pet_lover",
  "wants_kids",
  "dont_want_kids",
  "vegan",
  "active_fit",
  "vegetarian",
  "carnivore",
  "into_nature",
  "hiking",
];

const AUTH_PROVIDERS = {
  EMAIL: "email",
  PHONE: "phone",
  GOOGLE: "google",
  APPLE: "apple",
};

const NOTIFICATION_TYPES = {
  GENERAL: "general",
  MATCH: "match",
  MESSAGE: "message",
  SUBSCRIPTION: "subscription",
  SYSTEM: "system",
};

const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  PAST_DUE: "past_due",
};

module.exports = {
  GENDER,
  MARITAL_STATUS,
  LOOKING_FOR,
  SWIPE_ACTION,
  BELIEF_VALUES,
  LIFESTYLE_OPTIONS,
  AUTH_PROVIDERS,
  NOTIFICATION_TYPES,
  SUBSCRIPTION_STATUS,
};
