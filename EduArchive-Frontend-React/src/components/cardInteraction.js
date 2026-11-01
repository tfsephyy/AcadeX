/** Give existing clickable research cards the same keyboard access as pointer access. */
export function cardInteraction(onOpen) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: e => {
      if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); onOpen(); }
    },
  }
}
