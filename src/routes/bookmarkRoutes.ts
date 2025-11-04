import express from 'express';
import {
  getAllBookmarks,
  getBookmarkById,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  getAllFolders
} from '../controllers/bookmarkController';

const router = express.Router();

router.get('/', getAllBookmarks);
router.get('/folders', getAllFolders);
router.get('/:id', getBookmarkById);
router.post('/', createBookmark);
router.put('/:id', updateBookmark);
router.delete('/:id', deleteBookmark);

export default router;