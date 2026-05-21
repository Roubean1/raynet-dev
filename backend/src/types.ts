export interface BusinessCaseResponse {
  totalCount: number;
  data: BusinessCase[];
}

export type LeaderboardSortBy =
  | "wonRevenue"
  | "totalRevenue"
  | "activeRevenue"
  | "weightedRevenue"
  | "tradingProfit"
  | "businessCasesCount"
  | "wonCasesCount"
  | "winRate";

export interface SalespersonLeaderboardItem {
  rank: number;
  ownerId: number;
  ownerName: string;
  ownerEmail: string | null;
  businessCasesCount: number;
  wonCasesCount: number;
  activeCasesCount: number;
  lostCasesCount: number;
  totalRevenue: number;
  wonRevenue: number;
  activeRevenue: number;
  weightedRevenue: number;
  tradingProfit: number;
  averageDealSize: number;
  winRate: number;
}

export interface SalespersonLeaderboardResponse {
  generatedAt: string;
  totalSalespeople: number;
  sortBy: LeaderboardSortBy;
  data: SalespersonLeaderboardItem[];
}

export interface BusinessCase {
  id: number;
  _permission: number;
  _version: number;
  _entityName: "BusinessCase";
  code: string;
  name: string;
  company: Company;
  person: Person | null;
  owner: Person;
  currency: Currency;
  validFrom: string;
  validTill: string | null;
  scheduledEnd: string | null;
  totalAmount: number;
  totalAmountInDefaultCurrency: number;
  taxAmount: number;
  totalAmountWithTax: number;
  baseAmount: number;
  estimatedValue: number;
  tradingProfit: number;
  status: "B_ACTIVE" | "E_WIN" | "F_LOST";
  probability: number;
  exchangeRate: number;
  businessCaseType: BusinessCaseType;
  businessCasePhase: BusinessCasePhase;
  category: null;
  project: null;
  source: ContactSource | null;
  businessCaseClassification1: null;
  businessCaseClassification2: null;
  businessCaseClassification3: null;
  losingReason: string | null;
  losingCategory: LosingCategory | null;
  "rowInfo.createdAt": string;
  "rowInfo.createdBy": string;
  "rowInfo.rowAccess": null;
  "rowInfo.rowState": null;
  "rowInfo.updatedAt": string | null;
  "rowInfo.updatedBy": string | null;
  "rowInfo.lastModifiedAt": string;
  "rowInfo.lastModifiedBy": string;
  description: string | null;
  tags: string[] | null;
  securityLevel: SecurityLevel;
  prevActivity: string | null;
  nextActivity: string | null;
  customFields: null;
  inlineParticipants: null;
  inlineSign: null;
  lastPhaseChange: string | null;
  lastPhaseChangeDays: number | null;
  phaseChanges: unknown[];
}

export interface Company {
  id: number;
  _permission: number;
  _version: number;
  _entityName: "Company";
  name: string;
  regNumber: string;
  taxNumber: string | null;
  taxNumber2: string | null;
  primaryAddress: CompanyAddressPrimary;
  contactAddress: CompanyAddressContact;
  logo: FileRef | null;
  person: boolean;
  firstName: string | null;
  lastName: string | null;
  titleBefore: string | null;
  titleAfter: string | null;
  extIds: null;
}

export interface CompanyAddressPrimary {
  id: number;
  _permission: number;
  _version: number;
  _entityName: "CompanyAddress";
  "address.city": string;
  "contactInfo.email": string;
  "contactInfo.email2": string | null;
  territory: Territory | null;
  "contactInfo.tel1": string;
  "address.countryCode": string;
  "address.countryName": string;
}

export interface CompanyAddressContact {
  id: number;
  _permission: number;
  _version: number;
  _entityName: "CompanyAddress";
  "address.name": string;
  "address.street": string;
  "address.province": string | null;
  "address.zipCode": string;
  "address.city": string;
  "address.countryCode": string;
  "address.countryName": string;
  "address.lat": number;
  "address.lng": number;
  territory: Territory | null;
  "contactInfo.tel1": string;
  "contactInfo.tel1Normalized": string;
  "contactInfo.tel1Type": string | null;
  "contactInfo.tel2": string | null;
  "contactInfo.tel2Normalized": string | null;
  "contactInfo.tel2Type": string | null;
  "contactInfo.email": string;
  "contactInfo.email2": string | null;
  "contactInfo.www": string;
  "contactInfo.fax": string | null;
  "contactInfo.doNotSendMM": boolean;
  "contactInfo.otherContact": string | null;
  primary: boolean;
  contactAddress: boolean;
  extIds: null;
}

export interface Territory {
  id: number;
  _permission: number;
  _entityName: "Territory";
  code01: string;
  strValue01: string | null;
  sequenceNumber: number;
  rowAccess: null;
  extIds: null;
}

export interface FileRef {
  id: number;
  _permission: number;
  _version: number;
  _entityName: "File";
  contentType: string;
  fileName: string;
  iconSmallSize: number;
  iconSmallUuid: string | null;
  size: number;
  preview: boolean;
  uuid: string;
  iconMediumUuid: string | null;
  iconMediumSize: number;
  iconLargeUuid: string | null;
  iconLargeSize: number | null;
}

export interface Person {
  id: number;
  _permission: number;
  _version: number;
  _entityName: "Person";
  gender: "MALE" | "FEMALE" | null;
  fullName: string;
  fullNameWithoutTitles: string;
  firstName: string;
  lastName: string;
  titleBefore: string | null;
  notice: string | null;
  titleAfter: string | null;
  photo: FileRef | null;
  category: null;
  salutation: string | null;
  personClassification1: null;
  personClassification2: null;
  personClassification3: null;
  customFields: null;
  "contactInfo.tel1": string | null;
  "contactInfo.tel1Type": string | null;
  "contactInfo.tel2": string | null;
  "contactInfo.tel2Type": string | null;
  "contactInfo.email": string | null;
  "contactInfo.email2": string | null;
  "contactInfo.www": string | null;
  "privateAddress.countryCode": string | null;
  activeUserAccount: boolean;
  extIds: null;
  securityLevel: SecurityLevel;
}

export interface Currency {
  id: number;
  _permission: number;
  _entityName: "Currency";
  code01: string;
  code02: string;
  strValue01: string;
  sequenceNumber: number;
  rowAccess: null;
  extIds: null;
  config: CurrencyConfig;
}

export interface CurrencyConfig {
  places: number;
  format: string;
}

export interface BusinessCaseType {
  id: number;
  _permission: number;
  _entityName: "BusinessCaseType";
  code01: string;
  sequenceNumber: number;
  rowAccess: null;
  extIds: null;
}

export interface BusinessCasePhase {
  id: number;
  _permission: number;
  _entityName: "BusinessCasePhase";
  code01: string;
  color: string | null;
  status: "B_ACTIVE" | "E_WIN" | "F_LOST";
  probability: number | null;
  locked: boolean;
  rowAccess: null;
  sequenceNumber: number;
  totalCount: number | null;
  phaseSequenceNumber: number | null;
  businessCaseType: BusinessCaseType | null;
  extIds: null;
}

export interface ContactSource {
  id: number;
  _permission: number;
  _entityName: "ContactSource";
  code01: string;
  sequenceNumber: number;
  rowAccess: null;
  extIds: null;
}

export interface SecurityLevel {
  id: number;
  _permission: number;
  _entityName: "SecurityLevel";
  name: string;
  locked: boolean;
  extIds: null;
}

export interface LosingCategory {
  id: number;
  _permission: number;
  _entityName: "LosingCategory";
  code01: string;
  primary: boolean;
  sequenceNumber: number;
  rowAccess: null;
  extIds: null;
}
