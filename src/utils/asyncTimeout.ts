export const asyncSetTimeout = (timeout: number) =>
    new Promise((resolve) => setTimeout(resolve, timeout));
