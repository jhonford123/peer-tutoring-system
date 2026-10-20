export const DEPARTMENTS = [
  'Mathematics',
  'English',
  'Science',
  'Computer Science',
  'Computer Engineering',
  'Filipino',
  'Social Sciences',
  'Business',
  'Education',
];

export const CODING_LANGUAGE_SUBJECTS = [
  { code: 'CS-ASM', name: 'Assembly Language' },
  { code: 'CS-BASH', name: 'Bash and Shell Scripting' },
  { code: 'CS-C', name: 'C Programming' },
  { code: 'CS-CPP', name: 'C++ Programming' },
  { code: 'CS-CSHARP', name: 'C# Programming' },
  { code: 'CS-CLOJURE', name: 'Clojure Programming' },
  { code: 'CS-COBOL', name: 'COBOL Programming' },
  { code: 'CS-DART', name: 'Dart Programming' },
  { code: 'CS-ELIXIR', name: 'Elixir Programming' },
  { code: 'CS-ERLANG', name: 'Erlang Programming' },
  { code: 'CS-FSHARP', name: 'F# Programming' },
  { code: 'CS-FORTRAN', name: 'Fortran Programming' },
  { code: 'CS-GO', name: 'Go Programming' },
  { code: 'CS-GROOVY', name: 'Groovy Programming' },
  { code: 'CS-HASKELL', name: 'Haskell Programming' },
  { code: 'CS-JAVA', name: 'Java Programming' },
  { code: 'CS-JS', name: 'JavaScript Programming' },
  { code: 'CS-JULIA', name: 'Julia Programming' },
  { code: 'CS-KOTLIN', name: 'Kotlin Programming' },
  { code: 'CS-LISP', name: 'Lisp Programming' },
  { code: 'CS-LUA', name: 'Lua Programming' },
  { code: 'CS-MATLAB', name: 'MATLAB Programming' },
  { code: 'CS-OBJC', name: 'Objective-C Programming' },
  { code: 'CS-PERL', name: 'Perl Programming' },
  { code: 'CS-PHP', name: 'PHP Programming' },
  { code: 'CS-POWERSHELL', name: 'PowerShell Scripting' },
  { code: 'CS-PY', name: 'Python Programming' },
  { code: 'CS-R', name: 'R Programming' },
  { code: 'CS-RUBY', name: 'Ruby Programming' },
  { code: 'CS-RUST', name: 'Rust Programming' },
  { code: 'CS-SAS', name: 'SAS Programming' },
  { code: 'CS-SCALA', name: 'Scala Programming' },
  { code: 'CS-SQL', name: 'SQL Programming' },
  { code: 'CS-SCRATCH', name: 'Scratch Programming' },
  { code: 'CS-SOLIDITY', name: 'Solidity Programming' },
  { code: 'CS-SWIFT', name: 'Swift Programming' },
  { code: 'CS-TS', name: 'TypeScript Programming' },
  { code: 'CS-VB', name: 'Visual Basic Programming' },
];

export const CATEGORIES = [
  'Textbook',
  'Study Guide',
  'Lab Equipment',
  'Equipment',
  'Supplies',
];

export const CONDITIONS = ['new', 'good', 'fair', 'damaged'];

export const SESSION_STATUSES = ['scheduled', 'completed', 'cancelled'];

export const BOOK_CATEGORIES = ['Textbook', 'Study Guide', 'Reference', 'Novel', 'Workbook', 'Research Paper'];

export const formatDate = (date: string | null): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};
