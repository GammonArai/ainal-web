/**
 * バックアップ・復元サービス
 * Backup and restoration service for Ainaru Massage CMS
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const archiver = require('archiver');
const cron = require('node-cron');
const { logger } = require('../utils/logger');

const execAsync = util.promisify(exec);

class BackupService {
    constructor() {
        this.backupDir = process.env.BACKUP_STORAGE_PATH || path.join(__dirname, '../backups');
        this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
        this.isScheduled = false;
        this.initializeService();
    }

    /**
     * サービス初期化
     */
    async initializeService() {
        try {
            await this.ensureBackupDirectory();
            await this.setupScheduledBackups();
            logger.info('Backup service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize backup service:', error);
            throw error;
        }
    }

    /**
     * バックアップディレクトリ作成
     */
    async ensureBackupDirectory() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            
            // サブディレクトリも作成
            const subdirs = ['database', 'files', 'uploads', 'logs', 'full'];
            for (const subdir of subdirs) {
                await fs.mkdir(path.join(this.backupDir, subdir), { recursive: true });
            }
            
            logger.info(`Backup directories created at: ${this.backupDir}`);
        } catch (error) {
            logger.error('Failed to create backup directories:', error);
            throw error;
        }
    }

    /**
     * スケジュールバックアップ設定
     */
    async setupScheduledBackups() {
        if (this.isScheduled) return;

        const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // 毎日午前2時

        // データベースバックアップ（毎日）
        cron.schedule(schedule, async () => {
            logger.info('Starting scheduled database backup');
            try {
                await this.backupDatabase();
                await this.cleanupOldBackups();
                logger.info('Scheduled database backup completed');
            } catch (error) {
                logger.error('Scheduled database backup failed:', error);
            }
        });

        // フルバックアップ（毎週日曜日）
        cron.schedule('0 3 * * 0', async () => {
            logger.info('Starting scheduled full backup');
            try {
                await this.createFullBackup();
                await this.cleanupOldBackups();
                logger.info('Scheduled full backup completed');
            } catch (error) {
                logger.error('Scheduled full backup failed:', error);
            }
        });

        this.isScheduled = true;
        logger.info('Scheduled backups configured');
    }

    /**
     * データベースバックアップ
     */
    async backupDatabase() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `db_backup_${timestamp}.sql`;
        const backupPath = path.join(this.backupDir, 'database', backupFileName);

        try {
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'ainaru_massage_cms'
            };

            // mysqldumpコマンド構築
            const command = `mysqldump -h ${dbConfig.host} -u ${dbConfig.user} ${dbConfig.password ? `-p${dbConfig.password}` : ''} ${dbConfig.database} > ${backupPath}`;
            
            await execAsync(command);
            
            // バックアップファイルのサイズ確認
            const stats = await fs.stat(backupPath);
            
            if (stats.size === 0) {
                throw new Error('Backup file is empty');
            }

            // バックアップファイルを圧縮
            const compressedPath = await this.compressFile(backupPath);
            
            // 元のSQLファイルを削除
            await fs.unlink(backupPath);

            logger.info(`Database backup completed: ${compressedPath} (${stats.size} bytes)`);
            
            return {
                path: compressedPath,
                size: stats.size,
                timestamp: new Date(),
                type: 'database'
            };

        } catch (error) {
            logger.error('Database backup failed:', error);
            
            // 失敗した場合は部分的なファイルを削除
            try {
                await fs.unlink(backupPath);
            } catch (unlinkError) {
                // ファイルが存在しない場合は無視
            }
            
            throw error;
        }
    }

    /**
     * ファイルシステムバックアップ
     */
    async backupFiles() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `files_backup_${timestamp}.zip`;
        const backupPath = path.join(this.backupDir, 'files', backupFileName);

        try {
            const sourcePaths = [
                path.join(__dirname, '../../uploads'),
                path.join(__dirname, '../../logs'),
                path.join(__dirname, '../../../*.html'),
                path.join(__dirname, '../../../*.css'),
                path.join(__dirname, '../../../*.js'),
                path.join(__dirname, '../../../i18n'),
                path.join(__dirname, '../../../images')
            ];

            await this.createZipArchive(sourcePaths, backupPath);

            const stats = await fs.stat(backupPath);
            
            logger.info(`Files backup completed: ${backupPath} (${stats.size} bytes)`);
            
            return {
                path: backupPath,
                size: stats.size,
                timestamp: new Date(),
                type: 'files'
            };

        } catch (error) {
            logger.error('Files backup failed:', error);
            throw error;
        }
    }

    /**
     * フルバックアップ作成
     */
    async createFullBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `full_backup_${timestamp}.zip`;
        const backupPath = path.join(this.backupDir, 'full', backupFileName);

        try {
            logger.info('Starting full backup process');

            // 1. データベースバックアップ
            const dbBackup = await this.backupDatabase();
            logger.info('Database backup completed for full backup');

            // 2. ファイルバックアップ
            const filesBackup = await this.backupFiles();
            logger.info('Files backup completed for full backup');

            // 3. バックアップメタデータ作成
            const metadata = {
                timestamp: new Date(),
                version: require('../../package.json').version,
                database: dbBackup,
                files: filesBackup,
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    architecture: process.arch
                }
            };

            // 4. すべてを統合したZIPアーカイブ作成
            const sourcePaths = [
                dbBackup.path,
                filesBackup.path
            ];

            await this.createZipArchive(sourcePaths, backupPath, metadata);

            const stats = await fs.stat(backupPath);
            
            logger.info(`Full backup completed: ${backupPath} (${stats.size} bytes)`);
            
            return {
                path: backupPath,
                size: stats.size,
                timestamp: new Date(),
                type: 'full',
                metadata
            };

        } catch (error) {
            logger.error('Full backup failed:', error);
            throw error;
        }
    }

    /**
     * ZIPアーカイブ作成
     */
    async createZipArchive(sourcePaths, outputPath, metadata = null) {
        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(outputPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                logger.info(`Archive created: ${outputPath} (${archive.pointer()} bytes)`);
                resolve();
            });

            archive.on('error', (error) => {
                logger.error('Archive creation failed:', error);
                reject(error);
            });

            archive.pipe(output);

            // ソースファイル/ディレクトリを追加
            sourcePaths.forEach(sourcePath => {
                if (require('fs').existsSync(sourcePath)) {
                    const stats = require('fs').statSync(sourcePath);
                    
                    if (stats.isDirectory()) {
                        archive.directory(sourcePath, path.basename(sourcePath));
                    } else {
                        archive.file(sourcePath, { name: path.basename(sourcePath) });
                    }
                }
            });

            // メタデータがある場合は追加
            if (metadata) {
                archive.append(JSON.stringify(metadata, null, 2), { name: 'backup-metadata.json' });
            }

            archive.finalize();
        });
    }

    /**
     * ファイル圧縮
     */
    async compressFile(filePath) {
        const compressedPath = filePath + '.gz';
        
        try {
            await execAsync(`gzip -c "${filePath}" > "${compressedPath}"`);
            return compressedPath;
        } catch (error) {
            logger.error('File compression failed:', error);
            throw error;
        }
    }

    /**
     * データベース復元
     */
    async restoreDatabase(backupPath) {
        try {
            logger.info(`Starting database restoration from: ${backupPath}`);

            // バックアップファイルの存在確認
            await fs.access(backupPath);

            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'ainaru_massage_cms'
            };

            // 圧縮されたファイルの場合は展開
            let sqlPath = backupPath;
            if (backupPath.endsWith('.gz')) {
                sqlPath = backupPath.replace('.gz', '');
                await execAsync(`gunzip -c "${backupPath}" > "${sqlPath}"`);
            }

            // データベース復元実行
            const command = `mysql -h ${dbConfig.host} -u ${dbConfig.user} ${dbConfig.password ? `-p${dbConfig.password}` : ''} ${dbConfig.database} < "${sqlPath}"`;
            
            await execAsync(command);

            // 一時的に展開したファイルを削除
            if (sqlPath !== backupPath) {
                await fs.unlink(sqlPath);
            }

            logger.info('Database restoration completed successfully');
            
            return {
                success: true,
                restoredFrom: backupPath,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Database restoration failed:', error);
            throw error;
        }
    }

    /**
     * ファイル復元
     */
    async restoreFiles(backupPath, targetDir = null) {
        try {
            logger.info(`Starting files restoration from: ${backupPath}`);

            const extractDir = targetDir || path.join(__dirname, '../../restored');
            
            // 展開ディレクトリ作成
            await fs.mkdir(extractDir, { recursive: true });

            // ZIPファイル展開
            await execAsync(`unzip -o "${backupPath}" -d "${extractDir}"`);

            logger.info(`Files restoration completed to: ${extractDir}`);
            
            return {
                success: true,
                restoredFrom: backupPath,
                restoredTo: extractDir,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Files restoration failed:', error);
            throw error;
        }
    }

    /**
     * バックアップ一覧取得
     */
    async listBackups() {
        try {
            const backups = [];
            const backupTypes = ['database', 'files', 'full'];

            for (const type of backupTypes) {
                const typeDir = path.join(this.backupDir, type);
                
                try {
                    const files = await fs.readdir(typeDir);
                    
                    for (const file of files) {
                        const filePath = path.join(typeDir, file);
                        const stats = await fs.stat(filePath);
                        
                        backups.push({
                            name: file,
                            path: filePath,
                            type: type,
                            size: stats.size,
                            created: stats.birthtime,
                            modified: stats.mtime
                        });
                    }
                } catch (dirError) {
                    // ディレクトリが存在しない場合は無視
                }
            }

            // 作成日時で降順ソート
            backups.sort((a, b) => b.created - a.created);

            return backups;

        } catch (error) {
            logger.error('Failed to list backups:', error);
            throw error;
        }
    }

    /**
     * 古いバックアップのクリーンアップ
     */
    async cleanupOldBackups() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            const backups = await this.listBackups();
            let deletedCount = 0;

            for (const backup of backups) {
                if (backup.created < cutoffDate) {
                    try {
                        await fs.unlink(backup.path);
                        deletedCount++;
                        logger.info(`Deleted old backup: ${backup.name}`);
                    } catch (deleteError) {
                        logger.warn(`Failed to delete backup: ${backup.name}`, deleteError);
                    }
                }
            }

            logger.info(`Cleanup completed: ${deletedCount} old backups deleted`);
            return deletedCount;

        } catch (error) {
            logger.error('Backup cleanup failed:', error);
            throw error;
        }
    }

    /**
     * バックアップ削除
     */
    async deleteBackup(backupPath) {
        try {
            await fs.unlink(backupPath);
            logger.info(`Backup deleted: ${backupPath}`);
            
            return {
                success: true,
                deletedPath: backupPath,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error('Failed to delete backup:', error);
            throw error;
        }
    }

    /**
     * バックアップ検証
     */
    async verifyBackup(backupPath) {
        try {
            const stats = await fs.stat(backupPath);
            
            if (stats.size === 0) {
                return { valid: false, reason: 'Empty file' };
            }

            // ZIPファイルの場合は整合性チェック
            if (backupPath.endsWith('.zip')) {
                try {
                    await execAsync(`unzip -t "${backupPath}"`);
                } catch (zipError) {
                    return { valid: false, reason: 'Corrupted ZIP file' };
                }
            }

            // SQLファイルの場合は基本的な構文チェック
            if (backupPath.endsWith('.sql') || backupPath.endsWith('.sql.gz')) {
                // 実装: SQLファイルの基本的な検証
            }

            return {
                valid: true,
                size: stats.size,
                created: stats.birthtime,
                lastModified: stats.mtime
            };

        } catch (error) {
            return { 
                valid: false, 
                reason: error.message 
            };
        }
    }

    /**
     * システム状態取得
     */
    async getSystemStatus() {
        try {
            const backups = await this.listBackups();
            const diskSpace = await this.getDiskSpace();
            
            return {
                totalBackups: backups.length,
                latestBackup: backups[0] || null,
                oldestBackup: backups[backups.length - 1] || null,
                totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
                diskSpace: diskSpace,
                retentionDays: this.retentionDays,
                scheduledBackups: this.isScheduled
            };

        } catch (error) {
            logger.error('Failed to get system status:', error);
            throw error;
        }
    }

    /**
     * ディスク容量取得
     */
    async getDiskSpace() {
        try {
            const { stdout } = await execAsync(`df -h "${this.backupDir}"`);
            const lines = stdout.trim().split('\n');
            const data = lines[1].split(/\s+/);
            
            return {
                total: data[1],
                used: data[2],
                available: data[3],
                usagePercent: data[4]
            };

        } catch (error) {
            logger.warn('Failed to get disk space info:', error);
            return null;
        }
    }
}

module.exports = BackupService;