// Vector re-creation of the Legal Nexus hexagon mark (traced from the supplied logo).
export const MARK_VIEWBOX = "0 0 467 502";

export const MARK_INNER =
  '<defs><linearGradient id="lnx-navy" gradientUnits="userSpaceOnUse" x1="87" y1="157" x2="348" y2="344"><stop offset="0" stop-color="#002146"/><stop offset="0.4" stop-color="#00366a"/><stop offset="0.7" stop-color="#003669"/><stop offset="1" stop-color="#002045"/></linearGradient>' +
  '<linearGradient id="lnx-gold" gradientUnits="userSpaceOnUse" x1="386" y1="200" x2="68" y2="297"><stop offset="0" stop-color="#8d5d0f"/><stop offset="0.4" stop-color="#dca850"/><stop offset="0.7" stop-color="#d19b42"/><stop offset="1" stop-color="#aa751d"/></linearGradient>' +
  '<linearGradient id="lnx-teal" gradientUnits="userSpaceOnUse" x1="386" y1="378" x2="271" y2="216"><stop offset="0" stop-color="#003852"/><stop offset="0.4" stop-color="#01647e"/><stop offset="0.7" stop-color="#016e88"/><stop offset="1" stop-color="#017891"/></linearGradient></defs>' +
  '<path fill="url(#lnx-navy)" fill-rule="evenodd" d="M254 491L293 468 302 461 278 464 262 460 248 452 262 460 266 464 266 473 264 480ZM9 239L7 248 7 345 10 356 20 372 30 381 99 422 100 421 94 411 92 403 92 226 94 224 309 362 323 365 333 364 382 339 379 335 380 306 366 313 356 313 340 307 132 171 122 167 102 168 32 209 20 220ZM154 48L156 51 165 48 182 49 200 56 368 166 371 165 371 102 368 92 362 82 349 71 256 14 238 8 219 10 189 26Z"/>' +
  '<path fill="url(#lnx-gold)" fill-rule="evenodd" d="M123 281L123 348 125 352 133 359 222 413 229 416 236 412 240 416 239 422 242 425 268 441 283 447 299 448 315 445 356 428 437 380 452 363 458 348 458 306 450 318 437 330 354 377 333 386 312 386 295 379 250 353 127 278ZM10 150L7 161 7 215 9 215 17 200 30 187 86 152 106 143 124 143 140 149 151 157 163 163 231 209 349 282 355 283 357 280 357 195 355 191 350 186 181 73 159 65 143 65 137 67 133 65 155 52 154 49 149 51 129 66 123 68 29 124 18 135Z"/>' +
  '<path fill="url(#lnx-teal)" fill-rule="evenodd" d="M110 372L109 412 114 427 123 437 214 492 231 496 243 495 253 491 258 485 261 484 265 473 265 464 262 461 250 455 234 443 114 370ZM381 93L386 102 389 115 389 288 387 296 381 305 380 335 382 338 384 338 439 307 450 296 455 288 459 275 459 161 452 141 437 124 388 95Z"/>';

export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">${MARK_INNER}</svg>`;
export const MARK_DATA_URI = "data:image/svg+xml," + encodeURIComponent(MARK_SVG);
