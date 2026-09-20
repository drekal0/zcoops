import { customAlphabet, nanoid } from "nanoid";

export const newId = (prefix: string) => `${prefix}_${nanoid(16)}`;

// Human-friendly, unambiguous claim codes (no 0/O/1/I/L).
const codeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const rawCode = customAlphabet(codeAlphabet, 8);
export const newClaimCode = () => rawCode();
