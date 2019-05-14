/* eslint-disable no-underscore-dangle */
const fp = require('fastify-plugin');
const fs = require('fs-extra');
const archiver = require('archiver');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const dateFormatter = require('date-format');
const config = require('../config/index');
const viewsjs = require('../config/views');

async function couchdb(fastify, options) {
  // Update the views in couchdb with the ones defined in the code
  fastify.decorate(
    'checkAndCreateDb',
    () =>
      new Promise(async (resolve, reject) => {
        try {
          const databases = await fastify.couch.db.list();
          // check if the db exists
          if (databases.indexOf(config.db) < 0) {
            await fastify.couch.db.create(config.db);
          }
          const dicomDB = fastify.couch.db.use(config.db);
          // define an empty design document
          let viewDoc = {};
          viewDoc.views = {};
          // try and get the design document
          try {
            viewDoc = await dicomDB.get('_design/instances');
          } catch (e) {
            fastify.log.info('View document not found! Creating new one');
          }
          const keys = Object.keys(viewsjs.views);
          const values = Object.values(viewsjs.views);
          // update the views
          for (let i = 0; i < keys.length; i += 1) {
            viewDoc.views[keys[i]] = values[i];
          }
          // insert the updated/created design document
          await dicomDB.insert(viewDoc, '_design/instances', insertErr => {
            if (insertErr) {
              fastify.log.info(`Error updating the design document ${insertErr.message}`);
              reject(insertErr);
            } else {
              fastify.log.info('Design document updated successfully ');
              resolve();
            }
          });
        } catch (err) {
          fastify.log.info(`Error connecting to couchdb: ${err.message}`);
          reject(err);
        }
      })
  );

  fastify.decorate('getOtherHeaders', (imageAnnotation, header) => {
    // very clumsy, long code, but traverses once
    // Imaging observation, imaging physical entity
    if (imageAnnotation.imagingPhysicalEntityCollection) {
      let ipes = [];
      if (Array.isArray(imageAnnotation.imagingPhysicalEntityCollection.ImagingPhysicalEntity)) {
        ipes = imageAnnotation.imagingPhysicalEntityCollection.ImagingPhysicalEntity;
      } else {
        ipes.push(imageAnnotation.imagingPhysicalEntityCollection.ImagingPhysicalEntity);
      }
      ipes.forEach(ipe => {
        header.push({ id: ipe.label.value.toLowerCase(), title: ipe.label.value });
        if (ipe.imagingPhysicalEntityCharacteristicCollection) {
          let ipcs = [];
          if (
            Array.isArray(
              ipe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            )
          ) {
            ipcs =
              ipe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic;
          } else {
            ipcs.push(
              ipe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            );
          }
          ipcs.forEach(ipc => {
            header.push({
              id: ipc.label.value.toLowerCase(),
              title: ipc.label.value,
            });
          });
        }
      });
    }

    if (imageAnnotation.imagingObservationEntityCollection) {
      let ioes = [];
      if (
        Array.isArray(imageAnnotation.imagingObservationEntityCollection.ImagingObservationEntity)
      ) {
        ioes = imageAnnotation.imagingObservationEntityCollection.ImagingObservationEntity;
      } else {
        ioes.push(imageAnnotation.imagingObservationEntityCollection.ImagingObservationEntity);
      }
      ioes.forEach(ioe => {
        // imagingObservationEntity can have both imagingObservationEntityCharacteristic and imagingPhysicalEntityCharacteristic
        header.push({ id: ioe.label.value.toLowerCase(), title: ioe.label.value });
        if (ioe.imagingObservationEntityCharacteristicCollection) {
          let iocs = [];
          if (
            Array.isArray(
              ioe.imagingObservationEntityCharacteristicCollection
                .ImagingObservationEntityCharacteristic
            )
          ) {
            iocs = ioe.imagingObservationCharacteristicCollection.ImagingObservationCharacteristic;
          } else {
            isSecureContext.push(
              ioe.imagingObservationCharacteristicCollection.ImagingObservationCharacteristic
            );
          }
          iocs.forEach(ioc => {
            header.push({
              id: ioc.label.value.toLowerCase(),
              title: ioc.label.value,
            });
          });
        }
        let ipcs = [];
        if (ioe.imagingPhysicalEntityCharacteristicCollection) {
          if (
            Array.isArray(
              ioe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            )
          ) {
            ipcs =
              ioe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic;
          } else {
            ipcs.push(
              ioe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            );
          }
          ipcs.forEach(ipc => {
            header.push({
              id: ipc.label.value.toLowerCase(),
              title: ipc.label.value,
            });
          });
        }
      });
    }
    return header;
  });

  fastify.decorate('getOtherData', (imageAnnotation, rowIn) => {
    // very clumsy, long code, but traverses once
    const row = rowIn;
    // add imagingPhysicalEntitys
    if (imageAnnotation.imagingPhysicalEntityCollection) {
      let ipes = [];
      if (Array.isArray(imageAnnotation.imagingPhysicalEntityCollection.ImagingPhysicalEntity)) {
        ipes = imageAnnotation.imagingPhysicalEntityCollection.ImagingPhysicalEntity;
      } else {
        ipes.push(imageAnnotation.imagingPhysicalEntityCollection.ImagingPhysicalEntity);
      }
      ipes.forEach(ipe => {
        row[ipe.label.value.toLowerCase()] = ipe.typeCode['iso:displayName'].value;
        if (ipe.imagingPhysicalEntityCharacteristicCollection) {
          let ipcs = [];
          if (
            Array.isArray(
              ipe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            )
          ) {
            ipcs =
              ipe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic;
          } else {
            ipcs.push(
              ipe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            );
          }

          ipcs.forEach(ipc => {
            row[ipc.label.value.toLowerCase()] = ipc.typeCode['iso:displayName'].value;
          });
        }
      });
    }

    // add imagingObservationEntitys
    if (imageAnnotation.imagingObservationEntityCollection) {
      let ioes = [];
      if (
        Array.isArray(imageAnnotation.imagingObservationEntityCollection.ImagingObservationEntity)
      ) {
        ioes = imageAnnotation.imagingObservationEntityCollection.ImagingObservationEntity;
      } else {
        ioes.push(imageAnnotation.imagingObservationEntityCollection.ImagingObservationEntity);
      }
      ioes.forEach(ioe => {
        // imagingObservationEntity can have both imagingObservationEntityCharacteristic and imagingPhysicalEntityCharacteristic
        row[ioe.label.value.toLowerCase()] = ioe.typeCode['iso:displayName'].value;
        if (ioe.imagingObservationEntityCharacteristicCollection) {
          let iocs = [];
          if (
            Array.isArray(
              ioe.imagingObservationEntityCharacteristicCollection
                .ImagingObservationEntityCharacteristic
            )
          ) {
            iocs = ioe.imagingObservationCharacteristicCollection.ImagingObservationCharacteristic;
          } else {
            iocs.push(
              ioe.imagingObservationCharacteristicCollection.ImagingObservationCharacteristic
            );
          }
          iocs.forEach(ioc => {
            row[ioc.label.value.toLowerCase()] = ioc.typeCode['iso:displayName'].value;
          });
        }
        if (ioe.imagingPhysicalEntityCharacteristicCollection) {
          let ipcs = [];
          if (
            Array.isArray(
              ioe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            )
          ) {
            ipcs =
              ioe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic;
          } else {
            ipcs.push(
              ioe.imagingPhysicalEntityCharacteristicCollection.ImagingPhysicalEntityCharacteristic
            );
          }
          ipcs.forEach(ipc => {
            row[ipc.label.value.toLowerCase()] = ipc.typeCode['iso:displayName'].value;
          });
        }
      });
    }
    return row;
  });

  fastify.decorate(
    'downloadAims',
    async (params, aims) =>
      new Promise((resolve, reject) => {
        const timestamp = new Date().getTime();
        const dir = `tmp_${timestamp}`;
        // have a boolean just to avoid filesystem check for empty annotations directory
        let isThereDataToWrite = false;

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
          fs.mkdirSync(`${dir}/annotations`);
          // create the header base
          let header = [
            // Date_Created	Patient_Name	Patient_ID	Reviewer	Name Comment	Points	Study_UID	Series_UID	Image_UID
            { id: 'date', title: 'Date_Created' },
            { id: 'patientName', title: 'Patient_Name' },
            { id: 'patientId', title: 'Patient_ID' },
            { id: 'reviewer', title: 'Reviewer' },
            { id: 'name', title: 'Name' },
            { id: 'comment', title: 'Comment' },
            { id: 'userComment', title: 'User_Comment' },
            { id: 'points', title: 'Points' },
            { id: 'studyUid', title: 'Study_UID' },
            { id: 'seriedUid', title: 'Series_UID' },
            { id: 'imageUid', title: 'Image_UID' },
          ];

          const data = [];
          aims.forEach(aim => {
            if (params.summary && params.summary.toLowerCase() === 'true') {
              let imageAnnotations = [];
              if (
                Array.isArray(
                  aim.imageAnnotations.ImageAnnotationCollection.imageAnnotations.ImageAnnotation
                )
              ) {
                imageAnnotations =
                  aim.imageAnnotations.ImageAnnotationCollection.imageAnnotations.ImageAnnotation;
              } else {
                imageAnnotations.push(
                  aim.imageAnnotations.ImageAnnotationCollection.imageAnnotations.ImageAnnotation
                );
              }

              imageAnnotations.forEach(imageAnnotation => {
                const commentSplit = imageAnnotation.comment.value.split('~~');
                const points = [];
                if (imageAnnotation.markupEntityCollection) {
                  imageAnnotation.markupEntityCollection.MarkupEntity.twoDimensionSpatialCoordinateCollection.TwoDimensionSpatialCoordinate.forEach(
                    coor => {
                      points.push(`(${coor.x.value} ${coor.y.value})`);
                    }
                  );
                }

                header = fastify.getOtherHeaders(imageAnnotation, header);

                // add values common to all annotations
                let row = {
                  date: dateFormatter.asString(
                    dateFormatter.ISO8601_FORMAT,
                    dateFormatter.parse(
                      'yyyyMMddhhmmssSSS',
                      `${aim.imageAnnotations.ImageAnnotationCollection.dateTime.value}000`
                    )
                  ),
                  patientName: aim.imageAnnotations.ImageAnnotationCollection.person.name.value,
                  patientId: aim.imageAnnotations.ImageAnnotationCollection.person.id.value,
                  reviewer: aim.imageAnnotations.ImageAnnotationCollection.user.name.value,
                  name: imageAnnotation.name.value.split('~')[0],
                  comment: commentSplit[0],
                  userComment: commentSplit.length > 1 ? commentSplit[1] : '',
                  points: `[${points}]`,
                  studyUid:
                    imageAnnotation.imageReferenceEntityCollection.ImageReferenceEntity.imageStudy
                      .instanceUid.root,
                  seriedUid:
                    imageAnnotation.imageReferenceEntityCollection.ImageReferenceEntity.imageStudy
                      .imageSeries.instanceUid.root,
                  imageUid:
                    imageAnnotation.imageReferenceEntityCollection.ImageReferenceEntity.imageStudy
                      .imageSeries.imageCollection.Image.sopInstanceUid.root,
                };

                row = fastify.getOtherData(imageAnnotation, row);
                data.push(row);
              });
            }
            if (params.aim && params.aim.toLowerCase() === 'true') {
              fs.writeFileSync(
                `${dir}/annotations/${
                  aim.imageAnnotations.ImageAnnotationCollection.uniqueIdentifier.root
                }.json`,
                JSON.stringify(aim)
              );
              isThereDataToWrite = true;
            }
          });
          if (params.summary && params.summary.toLowerCase() === 'true') {
            // create the csv writer and write the summary
            const csvWriter = createCsvWriter({
              path: `${dir}/annotations/summary.csv`,
              header,
            });
            csvWriter
              .writeRecords(data)
              .then(() => fastify.log.info('The summary CSV file was written successfully'));
            isThereDataToWrite = true;
          }
          if (isThereDataToWrite) {
            // create a file to stream archive data to.
            const output = fs.createWriteStream(`${dir}/annotations.zip`);
            const archive = archiver('zip', {
              zlib: { level: 9 }, // Sets the compression level.
            });
            // create the archive
            archive
              .directory(`${dir}/annotations`, false)
              .on('error', err => reject(err))
              .pipe(output);

            output.on('close', () => {
              fastify.log.info(`Created zip in ./tmp_${timestamp}`);
              const readStream = fs.createReadStream(`${dir}/annotations.zip`);
              // delete tmp folder after the file is sent
              readStream.once('end', () => {
                readStream.destroy(); // make sure stream closed, not close if download aborted.
                fs.removeSync(`./tmp_${timestamp}`);
                fastify.log.info(`Deleted ./tmp_${timestamp}`);
              });
              resolve(readStream);
            });
            archive.finalize();
          } else {
            reject(new Error('No files to write!'));
          }
        }
      })
  );

  // add accessor methods with decorate
  fastify.decorate(
    'getAims',
    (format, params) =>
      new Promise(async (resolve, reject) => {
        try {
          // make sure there is value in all three even if empty
          const myParams = params;
          if (!params.subject) myParams.subject = '';
          if (!params.study) myParams.study = '';
          if (!params.series) myParams.series = '';

          // define which view to use according to the parameter format
          // default is json
          let view = 'aims_json';
          if (format) {
            if (format === 'json') view = 'aims_json';
            else if (format === 'summary') view = 'aims_summary';
          }
          const db = fastify.couch.db.use(config.db);
          db.view(
            'instances',
            view,
            {
              startkey: [myParams.subject, myParams.study, myParams.series, ''],
              endkey: [
                `${myParams.subject}\u9999`,
                `${myParams.study}\u9999`,
                `${myParams.series}\u9999`,
                '{}',
              ],
              reduce: true,
              group_level: 5,
            },
            (error, body) => {
              if (!error) {
                const res = [];

                if (format === 'summary') {
                  body.rows.forEach(instance => {
                    // get the actual instance object (tags only)
                    res.push(instance.key[4]);
                  });
                  resolve({ ResultSet: { Result: res } });
                } else if (format === 'stream') {
                  body.rows.forEach(instance => {
                    // get the actual instance object (tags only)
                    // the first 3 keys are patient, study, series, image
                    res.push(instance.key[4]);
                  });
                  // download aims only
                  fastify
                    .downloadAims({ aim: 'true' }, res)
                    .then(result => resolve(result))
                    .catch(err => reject(err));
                } else {
                  // the default is json! The old APIs were XML, no XML in epadlite
                  body.rows.forEach(instance => {
                    // get the actual instance object (tags only)
                    // the first 3 keys are patient, study, series, image
                    res.push(instance.key[4].imageAnnotations.ImageAnnotationCollection);
                  });
                  resolve({ imageAnnotations: { ImageAnnotationCollection: res } });
                }
              } else {
                // TODO Proper error reporting implementation required
                fastify.log.info(`Error in get series aims: ${error}`);
                reject(error);
              }
            }
          );
        } catch (err) {
          reject(err);
        }
      })
  );

  // add accessor methods with decorate
  fastify.decorate('getSeriesAims', (request, reply) => {
    fastify
      .getAims(request.query.format, request.params)
      .then(result => {
        if (request.query.format === 'stream') {
          reply.header('Content-Disposition', `attachment; filename=annotations.zip`);
        }
        reply.code(200).send(result);
      })
      .catch(err => reply.code(503).send(err));
  });

  // add accessor methods with decorate
  fastify.decorate('getStudyAims', (request, reply) => {
    fastify
      .getAims(request.query.format, request.params)
      .then(result => {
        if (request.query.format === 'stream') {
          reply.header('Content-Disposition', `attachment; filename=annotations.zip`);
        }
        reply.code(200).send(result);
      })
      .catch(err => reply.code(503).send(err));
  });

  // add accessor methods with decorate
  fastify.decorate('getSubjectAims', (request, reply) => {
    fastify
      .getAims(request.query.format, request.params)
      .then(result => {
        if (request.query.format === 'stream') {
          reply.header('Content-Disposition', `attachment; filename=annotations.zip`);
        }
        reply.code(200).send(result);
      })
      .catch(err => reply.code(503).send(err));
  });

  fastify.decorate('getProjectAims', (request, reply) => {
    fastify
      .getAims(request.query.format, request.params)
      .then(result => {
        if (request.query.format === 'stream') {
          reply.header('Content-Disposition', `attachment; filename=annotations.zip`);
        }
        reply.code(200).send(result);
      })
      .catch(err => reply.code(503).send(err));
  });

  // template accessors
  fastify.decorate('getAimsFromUIDs', (request, reply) => {
    try {
      if (Object.keys(request.query).length === 0) {
        reply.code(400).send("Query params shouldn't be empty");
      } else {
        const db = fastify.couch.db.use(config.db);
        const res = [];
        db.fetch({ keys: request.body }).then(data => {
          // db.fetch({ keys: ['2.25.2222222222222222222222'] }).then(data => {
          data.rows.forEach(item => {
            res.push(item.doc.aim);
          });
          reply.header('Content-Disposition', `attachment; filename=annotations.zip`);
          fastify
            .downloadAims(request.query, res)
            .then(result => reply.code(200).send(result))
            .catch(err => reply.code(503).send(err.message));
        });
      }
    } catch (err) {
      reply.code(503).send(err);
    }
  });

  fastify.decorate('saveAim', (request, reply) => {
    // get the uid from the json and check if it is same with param, then put as id in couch document
    if (
      request.params.aimuid &&
      request.params.aimuid !==
        request.body.imageAnnotations.ImageAnnotationCollection.uniqueIdentifier.root
    ) {
      fastify.log.info(
        'Conflicting aimuids: the uid sent in the url should be the same with imageAnnotations.ImageAnnotationCollection.uniqueIdentifier.root'
      );
      reply
        .code(503)
        .send(
          'Conflicting aimuids: the uid sent in the url should be the same with imageAnnotations.ImageAnnotationCollection.uniqueIdentifier.root'
        );
    }

    const couchDoc = {
      _id: request.body.imageAnnotations.ImageAnnotationCollection.uniqueIdentifier.root,
      aim: request.body,
    };
    const db = fastify.couch.db.use(config.db);
    db.get(couchDoc._id, (error, existing) => {
      if (!error) {
        couchDoc._rev = existing._rev;
        fastify.log.info(`Updating document for aimuid ${couchDoc._id}`);
      }

      db.insert(couchDoc, couchDoc._id)
        .then(() => {
          reply.code(200).send('Saving successful');
        })
        .catch(err => {
          // TODO Proper error reporting implementation required
          fastify.log.info(`Error in save: ${err}`);
          reply.code(503).send(`Saving error: ${err}`);
        });
    });
  });

  fastify.decorate('deleteAim', (request, reply) => {
    const db = fastify.couch.db.use(config.db);
    db.get(request.params.aimuid, (error, existing) => {
      if (error) {
        fastify.log.info(`No document for aimuid ${request.params.aimuid}`);
        // Is 404 the right thing to return?
        reply.code(404).send(`No document for aimuid ${request.params.aimuid}`);
      }

      db.destroy(request.params.aimuid, existing._rev)
        .then(() => {
          reply.code(200).send('Deletion successful');
        })
        .catch(err => {
          // TODO Proper error reporting implementation required
          fastify.log.info(`Error in delete: ${err}`);
          reply.code(503).send(`Deleting error: ${err}`);
        });
    });
  });

  // template accessors
  fastify.decorate('getTemplates', (request, reply) => {
    try {
      let type = 'image';
      // eslint-disable-next-line prefer-destructuring
      if (request.query.type) type = request.query.type.toLowerCase();
      const db = fastify.couch.db.use(config.db);
      db.view(
        'instances',
        'templates',
        {
          startkey: [type, '', ''],
          endkey: [`${type}\u9999`, '{}', '{}'],
          reduce: true,
          group_level: 3,
        },
        (error, body) => {
          if (!error) {
            const res = [];

            body.rows.forEach(template => {
              res.push(template.key[2]);
            });
            reply.code(200).send({ ResultSet: { Result: res } });
          } else {
            // TODO Proper error reporting implementation required
            fastify.log.info(`Error in get templates: ${error}`);
            reply.code(503).send(error);
          }
        }
      );
    } catch (err) {
      reply.code(503).send(err);
    }
  });

  fastify.decorate('saveTemplate', (request, reply) => {
    // get the uid from the json and check if it is same with param, then put as id in couch document
    if (request.params.uid && request.params.uid !== request.body.Template.uid) {
      fastify.log.info(
        'Conflicting uids: the uid sent in the url should be the same with request.body.Template.uid'
      );
      reply
        .code(503)
        .send(
          'Conflicting uids: the uid sent in the url should be the same with request.body.Template.uid'
        );
    }
    const couchDoc = {
      _id: request.body.Template.uid,
      template: request.body,
    };
    const db = fastify.couch.db.use(config.db);
    db.get(couchDoc._id, (error, existing) => {
      if (!error) {
        couchDoc._rev = existing._rev;
        fastify.log.info(`Updating document for uid ${couchDoc._id}`);
      }

      db.insert(couchDoc, couchDoc._id)
        .then(() => {
          reply.code(200).send('success');
        })
        .catch(err => {
          // TODO Proper error reporting implementation required
          fastify.log.info(`Error in save: ${err}`);
          reply.code(503).send('error');
        });
    });
  });

  fastify.decorate('deleteTemplate', (request, reply) => {
    const db = fastify.couch.db.use(config.db);
    db.get(request.params.uid, (error, existing) => {
      if (error) {
        fastify.log.info(`No document for uid ${request.params.uid}`);
        // Is 404 the right thing to return?
        reply.code(404).send(`No document for uid ${request.params.uid}`);
      }

      db.destroy(request.params.uid, existing._rev)
        .then(() => {
          reply.code(200).send('Deletion successful');
        })
        .catch(err => {
          // TODO Proper error reporting implementation required
          fastify.log.info(`Error in delete: ${err}`);
          reply.code(503).send(`Deleting error: ${err}`);
        });
    });
  });

  fastify.log.info(`Using db: ${config.db}`);
  // register couchdb
  // disables eslint check as I want this module to be standalone to be (un)pluggable
  // eslint-disable-next-line global-require
  fastify.register(require('fastify-couchdb'), {
    // eslint-disable-line global-require
    url: options.url,
  });
  fastify.after(async () => {
    try {
      await fastify.checkAndCreateDb();
    } catch (err) {
      fastify.log.info(`Cannot connect to couchdb (err:${err}), shutting down the server`);
      fastify.close();
    }
    // need to add hook for close to remove the db if test;
    fastify.addHook('onClose', async (instance, done) => {
      if (config.env === 'test') {
        try {
          // if it is test remove the database
          await instance.couch.db.destroy(config.db);
          fastify.log.info('Destroying test database');
        } catch (err) {
          fastify.log.info(`Cannot destroy test database (err:${err})`);
        }
        done();
      }
    });
  });
}
// expose as plugin so the module using it can access the decorated methods
module.exports = fp(couchdb);