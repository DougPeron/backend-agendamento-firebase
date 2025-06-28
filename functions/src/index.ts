import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express, {Request, Response, NextFunction} from "express";
import cors from "cors";


// Inicializa o app do Firebase Admin
admin.initializeApp();

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

const db = admin.firestore();

interface Booking {
  userId: string;
  courtId: string;
  startTime: Date;
  endTime: Date;
  status: string;
  createdAt: Date;
}

interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

// Middleware de verificação de token
const authMiddleware =
async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(403).send("Unauthorized: No token provided.");
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Adiciona os dados do usuário à requisição
    return next();
  } catch (error) {
    console.error("Error while verifying Firebase ID token:", error);
    return res.status(403).send("Unauthorized: Invalid token.");
  }
};

// Rota de Teste
app.get("/", (_req: Request, res: Response) => {
  res.send("API de Agendamento de Quadras (Firebase) está no ar!");
});

// ==========================================================
// ROTAS DE AGENDAMENTO
// ==========================================================

app.post("/bookings", authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const {courtId, startTime, endTime} = req.body;
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(403).json({error: "Usuário não autenticado."});
    }
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (start >= end) {
        return res.status(400).json({error:
            "O horário de término deve ser posterior ao de início."});
      }

      // Verificar se quadra existe
      const courtRef = db.collection("courts").doc(courtId);
      const courtDoc = await courtRef.get();
      if (!courtDoc.exists) {
        return res.status(404).json({error: "Quadra não encontrada."});
      }

      // Verificar conflito de horários no Firestore
      const bookingsRef = db.collection("bookings");
      const conflictQuery = await bookingsRef
        .where("courtId", "==", courtId)
        .where("status", "==", "Confirmado")
        .where("startTime", "<", end)
        .get();

      const conflictingBooking = conflictQuery.docs.find((doc) => {
        const booking = doc.data() as Booking &
          {endTime: admin.firestore.Timestamp};
        // Query Firestore pega todos que começam ANTES do término.
        // Filtrado em memória verifica se termina DEPOIS do início.
        return booking.endTime.toDate() > start;
      });

      if (conflictingBooking) {
        return res.status(409).json({error: "Este horário já está reservado."});
      }

      const newBooking: Booking = {
        userId,
        courtId,
        startTime: start,
        endTime: end,
        status: "Confirmado",
        createdAt: new Date(),
      };

      const bookingRef = await db.collection("bookings").add(newBooking);
      return res.status(201).json({id: bookingRef.id, ...newBooking});
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      return res.status(500).send("Erro no Servidor");
    }
  });

// Listar agendamentos de um usuário
app.get("/bookings/my-bookings",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(403).json({error: "Usuário não autenticado."});
      }
      const snapshot = await db.collection(
        "bookings").where("userId", "==", userId).get();
      const bookings: (Booking & {id: string})[]= [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Booking;
        bookings.push({id: doc.id, ...data});
      });
      return res.status(200).json(bookings);
    } catch (error) {
      console.error("Erro ao buscar agendamentos:", error);
      return res.status(500).send("Erro no Servidor");
    }
  });
// ==========================================================
// ROTA DE ATUALIZAÇÃO DE AGENDAMENTO
// ==========================================================


app.put("/bookings/:id", authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const bookingId = req.params.id;
    const user = req.user;
    const {startTime: newStartTime, endTime: newEndTime} = req.body;

    // Validação básica dos dados de entrada
    if (!newStartTime || !newEndTime) {
      return res.status(400).json({error:
        "Os novos horários de início e fim são obrigatórios."});
    }

    const start = new Date(newStartTime);
    const end = new Date(newEndTime);

    if (start >= end) {
      return res.status(400).json({error:
        "O horário de término deve ser posterior ao de início."});
    }

    try {
      const bookingRef = db.collection("bookings").doc(bookingId);
      const doc = await bookingRef.get();

      // 1. Verificar se o agendamento existe
      if (!doc.exists) {
        return res.status(404).json({error: "Agendamento não encontrado."});
      }

      const bookingData = doc.data();

      // 2. Verificação: só pode alterar o seu próprio agendamento.
      if (!bookingData || bookingData.userId !== user?.uid) {
        return res.status(403).json({
          error: "Acesso negado: você não tem "+
          "permissão para alterar este agendamento.",
        });
      }

      // 3. Checagem da regra de 24 horas de antecedência
      const now = new Date();
      // bookingData.startTime pode ser Date ou Firestore Timestamp
      const originalStartTime: Date =
        bookingData.startTime instanceof admin.firestore.Timestamp ?
          bookingData.startTime.toDate() :
          new Date(bookingData.startTime);

      const hoursDifference =
        (originalStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursDifference < 24) {
        return res.status(403).json({
          error: "Não é possível alterar agendamentos "+
          "com menos de 24 horas de antecedência.",
        });
      }

      // 4. Verificar conflito com outros horários (exceto ele mesmo)
      const bookingsRef = db.collection("bookings");
      const conflictQuery = await bookingsRef
        .where("courtId", "==", bookingData.courtId)
        .where("status", "==", "Confirmado")
        .where("startTime", "<", end)
        .get();

      // Verifica conflitos, ignora o agendamento a ser alterado
      const conflictingBooking = conflictQuery.docs.find((docSnapshot) => {
        // Ignora o próprio documento
        if (docSnapshot.id === bookingId) return false;
        const booking = docSnapshot.data();
        return booking.endTime.toDate() > start;
      });

      if (conflictingBooking) {
        return res.status(409).json({error:
          "O novo horário selecionado já está reservado."});
      }

      // 5. Se todas as validações passarem, atualizar o agendamento
      const updatedData = {
        startTime: start,
        endTime: end,
        updatedAt: new Date(),
      };

      await bookingRef.update(updatedData);

      return res.status(200).json({id: bookingId,
        ...bookingData, ...updatedData});
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      return res.status(500).send("Erro no Servidor");
    }
  });
// ==========================================================
// ROTA DE EXCLUSÃO DE AGENDAMENTO
// ==========================================================

app.delete("/bookings/:id", authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const bookingId: string = req.params.id;
    const user = req.user;

    try {
      const bookingRef = db.collection("bookings").doc(bookingId);
      const doc = await bookingRef.get();

      // 1. Verificar se o agendamento existe
      if (!doc.exists) {
        return res.status(404).json({error: "Agendamento não encontrado."});
      }

      const bookingData = doc.data() as Booking | undefined;

      // 2. Verifica permissões:
      // O usuário só pode deletar o próprio agendamento.
      if (!bookingData || bookingData.userId !== user?.uid) {
        return res.status(403).json({error:
          "Acesso negado: você não tem permissão "+
          "para excluir este agendamento."});
      }

      // 3. Se OK, deleta o documento
      await bookingRef.delete();

      return res.status(200).json({message:
        `Agendamento ${bookingId} deletado com sucesso.`});
    } catch (error) {
      console.error("Erro ao deletar agendamento:", error);
      return res.status(500).send("Erro no Servidor");
    }
  });


// Exporta a API do Express como uma única Cloud Function
exports.api = functions.https.onRequest(app);


