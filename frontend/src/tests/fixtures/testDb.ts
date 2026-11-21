import { MongoClient } from 'mongodb'
import { TEST_COLLECTION, TEST_DATABASE, TEST_MONGODB_URI } from './testEnv.ts'

/** Category documents as the backend stores them, for asserting on what actually landed in MongoDB. */
export interface CategoryDoc {
  _id: string
  categoryId: string
  docType: string
  name: string
  description: string
  isDefault: boolean
  testMaster: null | {
    categoryId: string
    uploadId: string
    fileName: string
    itemCount: number
    items: Array<Record<string, unknown>>
  }
}

export const DEFAULT_CATEGORIES = [
  { id: 'ae96a52b-2452-4c1d-913b-1c24ca162adf', name: 'WashingMachine' },
  { id: 'f451c173-3f02-46c9-ba01-f8e978fcfeb3', name: 'W/P - Water Purifier' },
  { id: 'bedfe577-fa22-4e33-839a-32f48678f6ee', name: 'C/F - Ceiling Fan' },
  { id: 'cd57d1a7-b86a-459f-a184-1138ca75c344', name: 'MWO - Microwave' },
  { id: '2db5f316-30e8-4fcb-9259-adcdba03cf65', name: 'AC - Air Conditioner' },
  { id: 'd8ac8fae-9afc-40e4-a33a-7674a2df0b61', name: 'REF - Refrigerator' },
  { id: 'cba67dd0-de40-468f-8261-cf6399cc3b5f', name: 'Others' },
]

const client = new MongoClient(TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
export const testCollection = client.db(TEST_DATABASE).collection<CategoryDoc>(TEST_COLLECTION)

export function categoryDocs(): Promise<CategoryDoc[]> {
  return testCollection.find({ docType: 'lgtm.category' }).toArray()
}

export function categoryDoc(name: string): Promise<CategoryDoc | null> {
  return testCollection.findOne({ docType: 'lgtm.category', name })
}

/** Empties the test collection; the backend recreates the defaults on the next listing. */
export async function resetCollection(): Promise<void> {
  await testCollection.deleteMany({})
}

export function closeTestDb(): Promise<void> {
  return client.close()
}
