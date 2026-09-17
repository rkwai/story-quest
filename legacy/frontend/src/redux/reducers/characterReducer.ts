import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Character {
  id: number;
  name: string;
  race: string;
  class: string;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  hitPoints: number;
  maxHitPoints: number;
  userId: number;
  campaignId: number | null;
  background: string;
  alignment: string;
  experience: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterState {
  characters: Character[];
  currentCharacter: Character | null;
  loading: boolean;
  error: string | null;
}

const initialState: CharacterState = {
  characters: [],
  currentCharacter: null,
  loading: false,
  error: null
};

const characterSlice = createSlice({
  name: 'characters',
  initialState,
  reducers: {
    getCharactersStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getCharactersSuccess: (state, action: PayloadAction<Character[]>) => {
      state.characters = action.payload;
      state.loading = false;
    },
    getCharactersFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    getCharacterStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    getCharacterSuccess: (state, action: PayloadAction<Character>) => {
      state.currentCharacter = action.payload;
      state.loading = false;
    },
    getCharacterFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    createCharacterStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    createCharacterSuccess: (state, action: PayloadAction<Character>) => {
      state.characters.push(action.payload);
      state.currentCharacter = action.payload;
      state.loading = false;
    },
    createCharacterFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateCharacterStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateCharacterSuccess: (state, action: PayloadAction<Character>) => {
      state.characters = state.characters.map(character => 
        character.id === action.payload.id ? action.payload : character
      );
      state.currentCharacter = action.payload;
      state.loading = false;
    },
    updateCharacterFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    deleteCharacterStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    deleteCharacterSuccess: (state, action: PayloadAction<number>) => {
      state.characters = state.characters.filter(character => character.id !== action.payload);
      state.currentCharacter = null;
      state.loading = false;
    },
    deleteCharacterFail: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    clearCharacterErrors: (state) => {
      state.error = null;
    }
  }
});

export const {
  getCharactersStart,
  getCharactersSuccess,
  getCharactersFail,
  getCharacterStart,
  getCharacterSuccess,
  getCharacterFail,
  createCharacterStart,
  createCharacterSuccess,
  createCharacterFail,
  updateCharacterStart,
  updateCharacterSuccess,
  updateCharacterFail,
  deleteCharacterStart,
  deleteCharacterSuccess,
  deleteCharacterFail,
  clearCharacterErrors
} = characterSlice.actions;

export default characterSlice.reducer; 