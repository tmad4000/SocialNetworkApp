# Social Network Platform

A modern social networking platform designed to facilitate professional and personal connections through advanced networking capabilities and intuitive user experiences.

## Features

- Express.js backend with TypeScript
- React-based frontend with modern UI components
- PostgreSQL database with Drizzle ORM
- Cross-platform content sharing
- Professional networking integrations
- User profiles with customizable "Looking For" field
- Advanced authentication with case-insensitive login
- Friend request system
- Rich text editing with Lexical editor
- LinkedIn profile integration
- Customizable bio and "Looking For" sections

## Prerequisites

- Node.js (v18 or later)
- PostgreSQL database (local or remote)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd social-network-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with:
```env
# For local PostgreSQL
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/<database>

# For remote PostgreSQL (e.g., Neon, Supabase)
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>?sslmode=require

# Optional: Override default port (5000)
PORT=3000
```

4. Push the database schema:
```bash
npm run db:push
```

5. Start the development server:
```bash
# Using default port (5000)
npm run dev

# Using custom port
PORT=3000 npm run dev
```

The application will be available at `http://localhost:<PORT>`.

## Connecting to Remote Databases

### Using Neon Database

1. Create a database on [Neon](https://neon.tech)
2. Get your connection string from the Neon dashboard
3. Add the connection string to your `.env` file:
```env
DATABASE_URL=postgresql://<username>:<password>@<host>/<database>?sslmode=require
```

### Common Database Issues

1. SSL Mode: When using remote databases, ensure `sslmode=require` is added to the connection string
2. Port Conflicts: If port 5000 is in use:
   - Use the PORT environment variable: `PORT=3000 npm run dev`
   - Check for and terminate any existing processes using the port:
     ```bash
     # Find process using port 5000
     lsof -i :5000
     # Kill the process
     kill -9 <PID>
     ```

## Development

- Frontend code is in the `client/src` directory
- Backend code is in the `server` directory
- Database schema is in `db/schema.ts`

### Key Directories

```
├── client/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   └── pages/        # Page components
├── server/               # Backend Express.js code
├── db/                   # Database schema and config
└── public/              # Static assets
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push database schema changes

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Key tables include:

- `users` - User accounts and profiles
  - Basic info (username, password)
  - Professional info (bio, LinkedIn URL)
  - Preferences ("Looking For" field)
- `posts` - User posts and content
- `friends` - Friend relationships and requests
- `postMentions` - Post mentions and tags

## Authentication

The platform uses session-based authentication with Passport.js. Features include:

- Secure password hashing with scrypt
- Session management
- Case-insensitive username matching
- Remember me functionality

## Friend Request System

The application includes a comprehensive friend request system:
- Send friend requests
- Accept/manage incoming requests
- View friend list
- Real-time notifications for new requests

## Professional Features

- LinkedIn profile integration
- Customizable "Looking For" field for networking intentions
- Professional bio section
- User discovery and networking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License. See LICENSE file for details.