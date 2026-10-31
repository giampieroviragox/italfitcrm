"use client";
import { createContext, useContext } from "react";
export const FormChangeContext = createContext<() => void>(() => {});
export const useFormChanged = () => useContext(FormChangeContext);
