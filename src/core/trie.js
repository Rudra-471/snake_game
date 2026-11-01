// Trie (prefix tree) used by the spawner to decide which letters can continue a word.
//
// Every node represents a prefix. For "cat", "cats", "car" the shape is:
//
//   root ─ c ─ a ─ t* ─ s*
//                └ r*                 (* = isWord)
//
// Each node also caches two aggregates, computed once after all words are inserted:
//   wordCount – how many words end in this node's subtree (including itself). The
//               spawner weights letters by this, so prefixes leading to many / longer
//               words show up more often.
//   maxDepth  – the length of the longest word that passes through this node. Used
//               for the HUD hint "Longest word possible from here: N letters" and to
//               drop branches that can't reach the minimum word length.

export class TrieNode {
  constructor(char = '', depth = 0) {
    this.char = char;
    this.depth = depth; // prefix length this node represents
    this.children = new Map();
    this.isWord = false;
    this.wordCount = 0;
    this.maxDepth = 0;
  }
}

export class Trie {
  constructor(words = []) {
    this.root = new TrieNode();
    this.size = 0;
    for (const w of words) this.insert(w);
    this.finalize();
  }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode(ch, node.depth + 1);
        node.children.set(ch, next);
      }
      node = next;
    }
    if (!node.isWord) {
      node.isWord = true;
      this.size++;
    }
  }

  /** Post-order pass that fills wordCount and maxDepth for every node. */
  finalize() {
    const visit = (node) => {
      let count = node.isWord ? 1 : 0;
      let deepest = node.isWord ? node.depth : 0;
      for (const child of node.children.values()) {
        visit(child);
        count += child.wordCount;
        deepest = Math.max(deepest, child.maxDepth);
      }
      node.wordCount = count;
      node.maxDepth = deepest;
    };
    visit(this.root);
  }

  /** Returns the node for a prefix, or null if no word starts with it. */
  find(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }

  has(word) {
    const node = this.find(word);
    return !!node && node.isWord;
  }

  isPrefix(prefix) {
    return this.find(prefix) !== null;
  }

  /**
   * Letters that can follow `prefix` and still lead to a word of at least `minLen`
   * letters. Returns [{ char, weight, node }].
   */
  continuations(prefix, minLen = 3) {
    const node = this.find(prefix);
    if (!node) return [];
    const out = [];
    for (const [char, child] of node.children) {
      if (child.maxDepth >= minLen) out.push({ char, weight: child.wordCount, node: child });
    }
    return out;
  }

  /** Longest word length reachable from this prefix (0 if none). */
  longestFrom(prefix) {
    const node = this.find(prefix);
    return node ? node.maxDepth : 0;
  }
}
